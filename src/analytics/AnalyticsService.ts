import * as crypto from 'crypto';
import * as vscode from 'vscode';
import type { AnalyticsRunRecord, AnalyticsQuery, AnalyticsFeedback, AnalyticsDashboardSummary } from './AnalyticsTypes';
import type { AnalyticsStore } from './AnalyticsStore';
import type { CostEstimator } from './CostEstimator';
import type { AnalyticsAggregator } from './AnalyticsAggregator';
import type { AnalyticsExporter } from './AnalyticsExporter';
import { ProductivityEstimator } from './ProductivityEstimator';

interface RunStartParams {
  taskId: string;
  conversationId?: string;
  conversationTitle?: string;
  provider: string;
  model?: string;
  mode: string;
  agentId?: string;
  skillIds?: string[];
  workspaceRoot?: string;
  startedAt: number;
}

interface RunCompleteParams {
  inputTokens: number;
  outputTokens: number;
  originalPromptTokens?: number;
  enhancedPromptTokens?: number;
  contextOverheadTokens?: number;
  exitCode?: number;
  workspaceRoot?: string;
}

interface RunFailedParams {
  errorMessage?: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface RunStoppedParams {
  inputTokens?: number;
  outputTokens?: number;
}

function hashPath(path: string): string {
  return crypto.createHash('sha256').update(path).digest('hex').slice(0, 16);
}

let _idCounter = 0;
function generateId(): string {
  return `${Date.now()}-${++_idCounter}`;
}

export class AnalyticsService {
  private readonly inProgress = new Map<string, AnalyticsRunRecord>();

  constructor(
    private readonly store: AnalyticsStore,
    private readonly costEstimator: CostEstimator,
    private readonly aggregator: AnalyticsAggregator,
    private readonly exporter: AnalyticsExporter,
    // Config parameter accepted for backward compatibility but reads lazily via getter
    _initialConfig?: vscode.WorkspaceConfiguration,
  ) { void _initialConfig; }

  recordRunStart(params: RunStartParams): void {
    if (!this.isEnabled()) return;

    const workspaceId = params.workspaceRoot
      ? hashPath(params.workspaceRoot)
      : undefined;

    const workspaceName = params.workspaceRoot
      ? params.workspaceRoot.split(/[/\\]/).pop()
      : undefined;

    const workspacePath = this.config.get<boolean>('analytics.storeWorkspacePath', false)
      ? params.workspaceRoot
      : undefined;

    const conversationTitle = this.config.get<boolean>('analytics.storeConversationTitle', false)
      ? params.conversationTitle
      : undefined;

    const record: AnalyticsRunRecord = {
      id: generateId(),
      taskId: params.taskId,
      conversationId: params.conversationId,
      conversationTitle,
      workspaceId,
      workspaceName,
      workspacePath,
      provider: params.provider,
      model: params.model,
      mode: params.mode,
      agentId: params.agentId,
      skillIds: params.skillIds,
      status: 'success', // optimistic — updated on complete/failed/stopped
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      originalPromptTokens: 0,
      enhancedPromptTokens: 0,
      contextOverheadTokens: 0,
      estimatedInputCostUsd: 0,
      estimatedOutputCostUsd: 0,
      estimatedTotalCostUsd: 0,
      filesChanged: 0,
      linesAdded: 0,
      linesDeleted: 0,
      testsGenerated: 0,
      bugsFixed: 0,
      estimatedTimeSavedMinutes: 0,
      startedAt: params.startedAt,
      feedback: 'none',
    };

    this.inProgress.set(params.taskId, record);
  }

  async recordRunComplete(taskId: string, params: RunCompleteParams): Promise<void> {
    if (!this.isEnabled()) return;

    const record = this.inProgress.get(taskId);
    if (!record) return;

    const completedAt = Date.now();
    const latencyMs = completedAt - record.startedAt;

    const costEnabled = this.config.get<boolean>('analytics.costEstimationEnabled', true);
    const cost = costEnabled
      ? this.costEstimator.estimate(record.provider, record.model, params.inputTokens, params.outputTokens)
      : { estimatedInputCostUsd: 0, estimatedOutputCostUsd: 0, estimatedTotalCostUsd: 0 };

    let productivity = {
      filesChanged: 0,
      linesAdded: 0,
      linesDeleted: 0,
      testsGenerated: 0,
      bugsFixed: 0,
      estimatedTimeSavedMinutes: 0,
    };

    if (params.workspaceRoot) {
      try {
        const estimator = new ProductivityEstimator(params.workspaceRoot);
        productivity = await estimator.estimate(record.mode);
      } catch {
        // Productivity estimation is non-critical
      }
    }

    const updated: AnalyticsRunRecord = {
      ...record,
      status: params.exitCode === 0 || params.exitCode == null ? 'success' : 'failed',
      exitCode: params.exitCode,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.inputTokens + params.outputTokens,
      originalPromptTokens: params.originalPromptTokens ?? 0,
      enhancedPromptTokens: params.enhancedPromptTokens ?? 0,
      contextOverheadTokens: params.contextOverheadTokens ?? 0,
      ...cost,
      ...productivity,
      completedAt,
      latencyMs,
    };

    this.inProgress.delete(taskId);
    await this.store.appendRun(updated);
  }

  async recordRunFailed(taskId: string, params: RunFailedParams): Promise<void> {
    if (!this.isEnabled()) return;

    const record = this.inProgress.get(taskId);
    if (!record) return;

    const completedAt = Date.now();
    const inputTokens = params.inputTokens ?? 0;
    const outputTokens = params.outputTokens ?? 0;

    const costEnabled = this.config.get<boolean>('analytics.costEstimationEnabled', true);
    const cost = costEnabled
      ? this.costEstimator.estimate(record.provider, record.model, inputTokens, outputTokens)
      : { estimatedInputCostUsd: 0, estimatedOutputCostUsd: 0, estimatedTotalCostUsd: 0 };

    const updated: AnalyticsRunRecord = {
      ...record,
      status: 'failed',
      errorMessage: params.errorMessage,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      ...cost,
      completedAt,
      latencyMs: completedAt - record.startedAt,
    };

    this.inProgress.delete(taskId);
    await this.store.appendRun(updated);
  }

  async recordRunStopped(taskId: string, params: RunStoppedParams): Promise<void> {
    if (!this.isEnabled()) return;

    const record = this.inProgress.get(taskId);
    if (!record) return;

    const completedAt = Date.now();
    const inputTokens = params.inputTokens ?? 0;
    const outputTokens = params.outputTokens ?? 0;

    const costEnabled = this.config.get<boolean>('analytics.costEstimationEnabled', true);
    const cost = costEnabled
      ? this.costEstimator.estimate(record.provider, record.model, inputTokens, outputTokens)
      : { estimatedInputCostUsd: 0, estimatedOutputCostUsd: 0, estimatedTotalCostUsd: 0 };

    const updated: AnalyticsRunRecord = {
      ...record,
      status: 'stopped',
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      ...cost,
      completedAt,
      latencyMs: completedAt - record.startedAt,
    };

    this.inProgress.delete(taskId);
    await this.store.appendRun(updated);
  }

  async getSummary(query?: AnalyticsQuery): Promise<AnalyticsDashboardSummary> {
    const records = await this.store.listRuns(query);
    return this.aggregator.aggregate(records);
  }

  async getRuns(query?: AnalyticsQuery): Promise<AnalyticsRunRecord[]> {
    return this.store.listRuns(query);
  }

  async updateFeedback(taskId: string, feedback: AnalyticsFeedback, reason?: string): Promise<void> {
    if (!this.isEnabled()) return;
    await this.store.updateFeedback(taskId, feedback, reason);
  }

  async export(format: 'json' | 'csv' | 'markdown', query?: AnalyticsQuery): Promise<string> {
    if (!this.config.get<boolean>('analytics.allowExport', true)) {
      throw new Error('Analytics export is disabled in settings.');
    }

    if (format === 'csv') {
      return this.store.exportCsv(query);
    }

    const runs = await this.store.listRuns(query);
    const summary = this.aggregator.aggregate(runs);

    if (format === 'json') {
      return this.exporter.toJson(summary, runs, query);
    }

    return this.exporter.toMarkdown(summary, runs);
  }

  async clearAll(): Promise<void> {
    await this.store.clearAll();
  }

  async pruneOld(): Promise<void> {
    const days = this.config.get<number>('analytics.retentionDays', 180);
    await this.store.pruneOlderThan(days);
  }

  private get config(): vscode.WorkspaceConfiguration {
    // Re-read each time to pick up configuration changes without reload
    return vscode.workspace.getConfiguration('nexus');
  }

  private isEnabled(): boolean {
    return this.config.get<boolean>('analytics.enabled', true);
  }
}
