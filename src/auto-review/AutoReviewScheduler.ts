import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { CodeReviewExecutor } from '../application/code-review/CodeReviewExecutor';
import type { CodeReviewRunnerFn } from '../application/code-review/CodeReviewExecutor';
import { CodeReviewContextBuilder } from '../application/code-review/CodeReviewContextBuilder';
import { readAutoReviewConfig, mapWatchModeToTarget } from './AutoReviewConfig';
import { scoreRisk } from './risk/RiskScoreEngine';
import { isRiskAtOrAbove } from './risk/RiskScoreTypes';
import { generateFingerprint } from './baseline/ReviewFingerprint';
import type { AutoReviewStateStore } from './AutoReviewStateStore';
import type { ReviewBaselineStore } from './baseline/ReviewBaselineStore';
import type { AutoReviewReport } from './AutoReviewReport';
import { ReviewPanel } from '../review/ReviewPanel';

export class AutoReviewScheduler {
  private lastDiffHash: string | null = null;
  private _running = false;
  private readonly contextBuilder = new CodeReviewContextBuilder();

  constructor(
    private readonly workspaceRoot: string,
    private readonly runnerFn: CodeReviewRunnerFn,
    private readonly extensionRoot: string,
    private readonly stateStore: AutoReviewStateStore,
    private readonly baselineStore: ReviewBaselineStore,
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceState: vscode.Memento,
  ) {}

  async trigger(): Promise<void> {
    if (this._running) return;
    this._running = true;

    try {
      const config = readAutoReviewConfig();
      const target = mapWatchModeToTarget(config.watchMode);
      const id = this.stateStore.generateId();
      const timestamp = Date.now();

      let context;
      try {
        context = this.contextBuilder.build(this.workspaceRoot, target, {
          maxDiffChars: config.maxDiffChars,
        });
      } catch {
        const skippedReport: AutoReviewReport = {
          id, timestamp, workspaceRoot: this.workspaceRoot,
          watchMode: config.watchMode,
          diffHash: '',
          risk: { level: 'low', score: 0, factors: [] },
          skipped: true,
          skipReason: 'No diff available',
        };
        this.stateStore.saveReport(skippedReport);
        return;
      }

      if (!context.diff || context.diff.trim().length === 0) return;

      const diffHash = crypto.createHash('sha256').update(context.diff).digest('hex').slice(0, 16);
      if (diffHash === this.lastDiffHash) return;
      this.lastDiffHash = diffHash;

      const risk = scoreRisk(context.diff, context.changedFiles);

      if (!isRiskAtOrAbove(risk.level, config.minRiskToRunAgent)) {
        const skippedReport: AutoReviewReport = {
          id, timestamp, workspaceRoot: this.workspaceRoot,
          watchMode: config.watchMode, diffHash, risk,
          skipped: true,
          skipReason: `Risk level '${risk.level}' is below threshold '${config.minRiskToRunAgent}'`,
        };
        this.stateStore.saveReport(skippedReport);
        if (config.retention.enabled) this.stateStore.pruneOldReports(config);
        return;
      }

      const preset = config.architectureDrift.enabled ? 'architecture' : 'balanced';
      const executor = new CodeReviewExecutor(this.runnerFn, this.extensionRoot);
      const codeReview = await executor.run({
        workspaceRoot: this.workspaceRoot,
        target,
        preset,
        maxDiffChars: config.maxDiffChars,
      });

      let baselineSuppressed = 0;
      let filteredFindings = codeReview.findings;
      if (config.baseline.enabled) {
        const before = filteredFindings.length;
        filteredFindings = filteredFindings.filter(f => {
          const fp = generateFingerprint(f);
          return !this.baselineStore.has(fp);
        });
        baselineSuppressed = before - filteredFindings.length;
      }

      const reviewWithBaseline = { ...codeReview, findings: filteredFindings };

      const finalReport: AutoReviewReport = {
        id, timestamp, workspaceRoot: this.workspaceRoot,
        watchMode: config.watchMode, diffHash, risk,
        skipped: false,
        codeReview: reviewWithBaseline,
        baselineSuppressed,
      };

      this.stateStore.saveReport(finalReport);
      if (config.retention.enabled) this.stateStore.pruneOldReports(config);

      const blockers = reviewWithBaseline.findings.filter(f => f.blocking).length;
      const msg = `Auto Review: ${reviewWithBaseline.verdict} — ${reviewWithBaseline.findings.length} finding(s)${blockers > 0 ? ` (${blockers} blocking)` : ''}`;

      const action = await vscode.window.showInformationMessage(msg, 'Open Report');
      if (action === 'Open Report') {
        await ReviewPanel.createOrShow(this.extensionUri, this.workspaceState, reviewWithBaseline);
      }
    } finally {
      this._running = false;
    }
  }
}
