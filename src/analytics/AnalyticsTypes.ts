export type AnalyticsRunStatus = 'success' | 'failed' | 'stopped';
export type AnalyticsFeedback = 'good' | 'bad' | 'none';

export interface AnalyticsRunRecord {
  id: string;
  taskId: string;
  conversationId?: string;
  conversationTitle?: string;
  workspaceId?: string;
  workspaceName?: string;
  workspacePath?: string;
  provider: string;
  providerLabel?: string;
  model?: string;
  mode: string;
  agentId?: string;
  skillIds?: string[];
  status: AnalyticsRunStatus;
  exitCode?: number;
  errorMessage?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  originalPromptTokens: number;
  enhancedPromptTokens: number;
  contextOverheadTokens: number;
  estimatedInputCostUsd: number;
  estimatedOutputCostUsd: number;
  estimatedTotalCostUsd: number;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  testsGenerated: number;
  bugsFixed: number;
  estimatedTimeSavedMinutes: number;
  startedAt: number;
  completedAt?: number;
  latencyMs?: number;
  feedback: AnalyticsFeedback;
  feedbackReason?: string;
  workflowName?: string;
  workflowKey?: string;
  promptHash?: string;
}

export interface AnalyticsQuery {
  from?: number;
  to?: number;
  provider?: string;
  model?: string;
  mode?: string;
  conversationId?: string;
  workspaceId?: string;
  status?: AnalyticsRunStatus;
}

export interface ProviderSummary {
  provider: string;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  stoppedRuns: number;
  totalTokens: number;
  estimatedCostUsd: number;
  reliability: number;
  avgLatencyMs: number;
  confidenceLow: boolean;
}

export interface ModeSummary {
  mode: string;
  totalRuns: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface ConversationSummary {
  conversationId: string;
  conversationTitle?: string;
  totalRuns: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface WorkspaceSummary {
  workspaceId: string;
  workspaceName?: string;
  totalRuns: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AgentSummary {
  agentId: string;
  totalRuns: number;
}

export interface SkillSummary {
  skillId: string;
  totalRuns: number;
}

export interface WorkflowSummary {
  workflowKey: string;
  workflowName?: string;
  totalRuns: number;
  estimatedCostUsd: number;
}

export interface AnalyticsDashboardSummary {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  stoppedRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
  avgLatencyMs: number;
  avgCostPerRun: number;
  tasksCompleted: number;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  testsGenerated: number;
  bugsFixed: number;
  estimatedTimeSavedMinutes: number;
  acceptanceRate: number;
  goodFeedbackCount: number;
  badFeedbackCount: number;
  byProvider: ProviderSummary[];
  byMode: ModeSummary[];
  byConversation: ConversationSummary[];
  byWorkspace: WorkspaceSummary[];
  mostUsedAgents: AgentSummary[];
  mostUsedSkills: SkillSummary[];
  mostExpensiveWorkflows: WorkflowSummary[];
}
