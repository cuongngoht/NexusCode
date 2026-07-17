import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { CodeReviewExecutor } from '../application/code-review/CodeReviewExecutor';
import type { CodeReviewRunnerFn } from '../application/code-review/CodeReviewExecutor';
import { CodeReviewContextBuilder } from '../application/code-review/CodeReviewContextBuilder';
import {
  ProjectMemoryStatusService,
  ProjectMemoryRagFacade,
  FsProjectMemoryIndexRepository,
} from '../context/project-memory';
import { readAutoReviewConfig, mapWatchModeToTarget } from './AutoReviewConfig';
import { scoreRisk, boostRisk } from './risk/RiskScoreEngine';
import { isRiskAtOrAbove } from './risk/RiskScoreTypes';
import { generateFingerprint } from './baseline/ReviewFingerprint';
import { ArchitectureDriftDetector, type ArchitectureDriftResult } from './architecture/ArchitectureDriftDetector';
import { CodeReviewPolicy } from '../application/code-review/CodeReviewPolicy';
import type { AutoReviewStateStore } from './AutoReviewStateStore';
import type { ReviewBaselineStore } from './baseline/ReviewBaselineStore';
import type { AutoReviewReport } from './AutoReviewReport';
import { ReviewPanel } from '../review/ReviewPanel';

export class AutoReviewScheduler {
  private lastDiffHash: string | null = null;
  private _running = false;
  private readonly contextBuilder = new CodeReviewContextBuilder();
  private readonly projectMemoryStatusService = new ProjectMemoryStatusService();
  private readonly projectMemoryRagFacade = new ProjectMemoryRagFacade(new FsProjectMemoryIndexRepository());
  private readonly driftDetector = new ArchitectureDriftDetector();

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

      let drift: ArchitectureDriftResult | undefined;
      if (config.architectureDrift.enabled) {
        try {
          drift = await this.driftDetector.detect(this.workspaceRoot, context.changedFiles);
        } catch {
          // Non-blocking: Auto Review must still run even if the drift check fails
        }
      }
      const driftReportInfo = drift
        ? { checked: drift.checked, newViolationCount: drift.newViolations.length }
        : undefined;
      const effectiveRisk = drift && drift.riskBoost.score > 0
        ? boostRisk(risk, drift.riskBoost.score, drift.riskBoost.factors)
        : risk;

      if (!isRiskAtOrAbove(effectiveRisk.level, config.minRiskToRunAgent)) {
        const skippedReport: AutoReviewReport = {
          id, timestamp, workspaceRoot: this.workspaceRoot,
          watchMode: config.watchMode, diffHash, risk: effectiveRisk,
          skipped: true,
          skipReason: `Risk level '${effectiveRisk.level}' is below threshold '${config.minRiskToRunAgent}'`,
          architectureDrift: driftReportInfo,
        };
        this.stateStore.saveReport(skippedReport);
        if (config.retention.enabled) this.stateStore.pruneOldReports(config);
        return;
      }

      const projectMemoryContext = await this.buildProjectMemoryContext(context);

      const preset = config.architectureDrift.enabled ? 'architecture' : 'balanced';
      const executor = new CodeReviewExecutor(this.runnerFn, this.extensionRoot);
      const codeReview = await executor.run({
        workspaceRoot: this.workspaceRoot,
        target,
        preset,
        maxDiffChars: config.maxDiffChars,
        projectMemoryContext,
      });

      let baselineSuppressed = 0;
      // Drift findings go through the same baseline suppression as agent findings
      let filteredFindings = [...(drift?.findings ?? []), ...codeReview.findings];
      if (config.baseline.enabled) {
        const before = filteredFindings.length;
        filteredFindings = filteredFindings.filter(f => {
          const fp = generateFingerprint(f);
          return !this.baselineStore.has(fp);
        });
        baselineSuppressed = before - filteredFindings.length;
      }

      const reviewWithBaseline = {
        ...codeReview,
        findings: filteredFindings,
        stats: new CodeReviewPolicy().calculateStats(filteredFindings),
      };

      const finalReport: AutoReviewReport = {
        id, timestamp, workspaceRoot: this.workspaceRoot,
        watchMode: config.watchMode, diffHash, risk: effectiveRisk,
        skipped: false,
        codeReview: reviewWithBaseline,
        baselineSuppressed,
        architectureDrift: driftReportInfo,
      };

      this.stateStore.saveReport(finalReport);
      if (config.retention.enabled) this.stateStore.pruneOldReports(config);

      const blockers = reviewWithBaseline.findings.filter(f => f.blocking).length;
      const driftCount = driftReportInfo?.newViolationCount ?? 0;
      const msg = `Auto Review: ${reviewWithBaseline.verdict} — ${reviewWithBaseline.findings.length} finding(s)${blockers > 0 ? ` (${blockers} blocking)` : ''}${driftCount > 0 ? ` (${driftCount} architecture drift)` : ''}`;

      const action = await vscode.window.showInformationMessage(msg, 'Open Report');
      if (action === 'Open Report') {
        await ReviewPanel.createOrShow(this.extensionUri, this.workspaceState, reviewWithBaseline);
      }
    } finally {
      this._running = false;
    }
  }

  private async buildProjectMemoryContext(context: { changedFiles: { path: string }[] }): Promise<string | undefined> {
    const cfg = vscode.workspace.getConfiguration('nexus');
    if (!cfg.get<boolean>('projectMemory.rag.enabled', true)) return undefined;

    try {
      const projectMemoryStatus = await this.projectMemoryStatusService.getStatus(this.workspaceRoot);
      const changedPaths = context.changedFiles.map(f => f.path).join(' ');
      const query = changedPaths || 'code review architecture';
      const { ragContext } = await this.projectMemoryRagFacade.buildRagForPrompt(
        query,
        this.workspaceRoot,
        projectMemoryStatus,
        {
          maxResults: cfg.get<number>('projectMemory.rag.maxResults', 5),
          maxChars: cfg.get<number>('projectMemory.rag.maxChars', 4000),
          minScore: cfg.get<number>('projectMemory.rag.minScore', 1.0),
        },
      );
      return ragContext ?? undefined;
    } catch {
      // Non-blocking: Auto Review must still run even if RAG lookup fails
      return undefined;
    }
  }
}
