import { ProviderId, TaskMode, GitFileChange, GitReviewContext } from '../core/types';
import type { CodeReviewReport } from '../application/code-review/CodeReviewReport';
import type { CodeReviewTarget } from '../application/code-review/CodeReviewTarget';
import type { CodeReviewPreset } from '../application/code-review/CodeReviewPromptBuilder';
import type { PromptAttachment } from '../core/types';
import type { NexusStreamEvent } from '../core/stream/NexusStreamEvent';
import type { ProviderDetectionResult } from '../provider-hub/ProviderTypes';
import type { ChatHistoryState, SerializedChatMessage, SerializedConversationCompactSummary } from '../core/chat/ChatHistory';
import type { TokenRunUsage } from '../core/tokens/TokenUsage';
import type { AgentModeCapability, AgentRecommendation } from '../application/nexus/AgentCapabilityMatrix';
import type { McpPresetStatusView } from '../mcp/McpTypes';
import type { AgentPrompt } from '../context/agentPromptLibrary';
import type { SkillPrompt } from '../context/skillPromptLibrary';
import type { FileDiffSummary } from '../git/structuredDiff';
import type { ArtifactRef } from '../artifacts/ArtifactTypes';
import type { AnalyticsDashboardSummary, AnalyticsRunRecord, AnalyticsQuery, AnalyticsFeedback } from '../analytics/AnalyticsTypes';
import type { HistorySearchResultView, HistoryRagSourceView } from '../context/history-search/types';

export type { PromptAttachment };

export type { ProviderDetectionResult };

export type { AgentPrompt };

export type { SkillPrompt };

// Messages sent from the extension to the webview
export type ExtensionMessage =
  | { type: 'stdout'; chunk: string }
  | { type: 'stderr'; chunk: string }
  | { type: 'reasoning'; chunk: string }
  | { type: 'taskStarted'; taskId: string; provider: string; mode: string; model?: string; enhancedPrompt?: string; enhancedPromptSections?: Array<{ title: string; content: string }> }
  | { type: 'taskCompleted'; taskId: string; exitCode: number }
  | { type: 'taskStopped'; taskId: string }
  | { type: 'taskError'; taskId: string; message: string }
  | { type: 'gitStatus'; changes: GitFileChange[]; message?: string }
  | {
      type: 'availableProviders';
      providers: string[];
      detection: ProviderDetectionResult[];
      needsSetup?: boolean;
      savedProvider?: string;
      capabilityMatrix?: AgentModeCapability[];
      recommendations?: AgentRecommendation[];
    }
  | { type: 'stepStarted'; stepLabel: string; stepIndex: number; totalSteps: number; provider: string; mode: string; model?: string }
  | { type: 'stepCompleted'; stepLabel: string }
  | { type: 'stepError'; stepLabel: string; error: string }
  | { type: 'activityStarted'; activityKind: string; label: string }
  | { type: 'activityDone'; activityKind: string; label: string; status: 'done' | 'error' }
  | { type: 'historyLoaded'; history: ChatHistoryState }
  | { type: 'historyError'; message: string }
  | { type: 'historySaveError'; message: string }
  | { type: 'historyTrimmed'; removedCount: number }
  | { type: 'reviewContext'; context: GitReviewContext }
  | { type: 'reviewContextError'; message: string }
  | {
      type: 'tokenUsageUpdated';
      taskId: string;
      phase: 'preview' | 'final';
      usage: TokenRunUsage;
    }
  | { type: 'planSaved'; taskId: string; planPath?: string }
  | { type: 'planReadyForApproval'; taskId: string; planPath?: string; plan: string; mode: string; model?: string }
  | { type: 'planRejected'; planPath?: string }
  | { type: 'promptAttachmentPicked'; attachment: PromptAttachment }
  | { type: 'droppedFilesResolved'; attachments: PromptAttachment[] }
  | { type: 'workspaceFiles'; files: string[] }
  | { type: 'mcpStatus'; enabled: boolean; presets: McpPresetStatusView[] }
  | { type: 'mcpUsed'; presetId: string; presetName: string; toolName: string }
  | { type: 'agentPrompts'; agents: AgentPrompt[] }
  | { type: 'agentsReloaded'; count: number; agents: AgentPrompt[] }
  | { type: 'agentPromptError'; message: string }
  | { type: 'skillPrompts'; skills: SkillPrompt[] }
  | { type: 'skillsReloaded'; count: number; skills: SkillPrompt[] }
  | { type: 'skillPromptError'; message: string }
  | { type: 'compactStarted'; conversationId: string }
  | { type: 'compactSummaryUpdated'; conversationId: string; summary: SerializedConversationCompactSummary }
  | { type: 'compactSummaryError'; conversationId: string; message: string }
  // Diff viewer messages
  | { type: 'fileDiffLoaded'; path: string; diff: FileDiffSummary }
  | { type: 'allDiffsLoaded'; diffs: FileDiffSummary[] }
  | { type: 'fileDiffError'; path?: string; message: string }
  | { type: 'gitDiffRefreshed'; changedFiles: GitFileChange[] }
  // Artifact messages
  | { type: 'artifactsListed'; artifacts: ArtifactRef[] }
  | { type: 'artifactCreated'; artifact: ArtifactRef }
  | { type: 'artifactPreviewLoaded'; artifactId: string; content?: string; uri?: string; mimeType?: string; truncated?: boolean }
  | { type: 'artifactDeleted'; artifactId: string }
  | { type: 'artifactError'; artifactId?: string; message: string }
  // Analytics messages
  | { type: 'analyticsSummary'; summary: AnalyticsDashboardSummary }
  | { type: 'analyticsRuns'; runs: AnalyticsRunRecord[] }
  | { type: 'analyticsExported'; path: string }
  | { type: 'analyticsError'; message: string }
  // Nexus native streaming protocol
  | { type: 'nexusStreamEvent'; event: NexusStreamEvent }
  // History search messages (posted by HistorySearchHandler — received but not displayed by webview)
  | { type: 'historySearchResults'; query: string; results: HistorySearchResultView[] }
  | { type: 'historySearchIndexReady'; documentCount: number; builtAt: number }
  | { type: 'historySearchIndexCleared' }
  | { type: 'historySearchError'; message: string }
  // History RAG messages
  | { type: 'historyRagContextUsed'; resultCount: number; totalChars: number; sources: HistoryRagSourceView[] }
  // Code Review messages (extension → webview)
  | { type: 'codeReviewStarted'; reportId: string; targetType: string }
  | { type: 'codeReviewProgress'; reportId: string; message: string }
  | { type: 'codeReviewReport'; report: CodeReviewReport }
  | { type: 'codeReviewError'; message: string }
  // Subagent trace messages
  | { type: 'subagentStarted'; runId: string; role: string; agentId?: string; displayName?: string }
  | { type: 'subagentCompleted'; runId: string; role: string; agentId?: string; durationMs: number; confidence?: number; findingCount?: number }
  | { type: 'subagentFailed'; runId: string; role: string; agentId?: string; durationMs?: number; error: string }
  | { type: 'subagentSynthesis'; runId: string; summary: { topFindings: number; files: string[]; risks: string[]; confidence: number } }
  // Agent Mode messages (extension → webview)
  | { type: 'agentSessionUpdated'; session: AgentSessionViewModel }
  | { type: 'agentTimelineUpdated'; sessionId: string; events: AgentTimelineEventViewModel[] }
  | { type: 'agentPlanReadyForApproval'; sessionId: string; plan: AgentPlanViewModel; planText: string }
  | { type: 'agentPlanApproved'; sessionId: string }
  | { type: 'agentPlanRejected'; sessionId: string; reason?: string }
  | { type: 'agentCheckpointCreated'; sessionId: string; checkpointId: string }
  | { type: 'agentStepStarted'; sessionId: string; step: AgentStepViewModel }
  | { type: 'agentStepCompleted'; sessionId: string; step: AgentStepViewModel }
  | { type: 'agentStepFailed'; sessionId: string; step: AgentStepViewModel; error: string }
  | { type: 'agentCommandApprovalRequested'; sessionId: string; request: AgentCommandApprovalViewModel }
  | { type: 'agentTestResult'; sessionId: string; result: AgentTestResultViewModel }
  | { type: 'agentRecoveryResult'; sessionId: string; result: AgentRecoveryResultViewModel }
  | { type: 'agentReviewResult'; sessionId: string; result: AgentReviewResultViewModel }
  | { type: 'agentDiffCollected'; sessionId: string; diff: AgentDiffSummaryViewModel }
  | { type: 'agentFinalSummary'; sessionId: string; summary: AgentFinalSummaryViewModel };

// ── Agent Mode view models (kept near the protocol definition) ────────────

export interface AgentSessionViewModel {
  id: string;
  status: string;
  originalPrompt: string;
  currentStepId?: string;
  steps: AgentStepViewModel[];
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export interface AgentStepViewModel {
  id: string;
  type: string;
  title: string;
  status: string;
  error?: string;
}

export interface AgentPlanViewModel {
  summary: string;
  filesToRead: string[];
  filesToEdit: string[];
  filesToCreate: string[];
  filesToDelete: string[];
  commandsToRun: string[];
  risks: string[];
  assumptions: string[];
  testStrategy: string[];
  rollbackStrategy: string[];
  docsImpact: string[];
  securityImpact: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface AgentTimelineEventViewModel {
  id: string;
  sessionId: string;
  type: string;
  message: string;
  timestamp: number;
  data?: unknown;
}

export interface AgentCommandApprovalViewModel {
  id: string;
  sessionId: string;
  command: string;
  cwd: string;
  risk: 'low' | 'medium' | 'high' | 'blocked';
  reason: string;
  createdAt: number;
}

export interface AgentTestResultViewModel {
  sessionId: string;
  passed: boolean;
  commands: {
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    passed: boolean;
  }[];
  durationMs: number;
}

export interface AgentRecoveryResultViewModel {
  sessionId: string;
  attempts: number;
  recovered: boolean;
  errors: string[];
}

export interface AgentReviewResultViewModel {
  sessionId: string;
  passed: boolean;
  summary: string;
  findings: {
    severity: 'info' | 'warning' | 'error';
    category: string;
    file?: string;
    message: string;
    suggestion?: string;
  }[];
}

export interface AgentDiffSummaryViewModel {
  sessionId: string;
  changedFiles: {
    path: string;
    status: string;
    additions?: number;
    deletions?: number;
  }[];
  addedLines: number;
  deletedLines: number;
  diffStat: string;
  diff?: string;
  diffTruncated: boolean;
}

export interface AgentFinalSummaryViewModel {
  sessionId: string;
  status: 'completed' | 'failed' | 'completed_with_warnings';
  userTask: string;
  implementationSummary: string;
  changedFiles: AgentDiffSummaryViewModel['changedFiles'];
  warnings: string[];
  nextSteps: string[];
}

// Messages sent from the webview to the extension
export type WebviewMessage =
  | { type: 'runTask'; prompt: string; provider: ProviderId; mode: TaskMode; model?: string; conversationId: string; baseBranch?: string; attachments?: PromptAttachment[]; subagentsEnabled?: boolean; conversationContext?: string }
  | { type: 'pickPromptAttachment' }
  | { type: 'getWorkspaceFiles' }
  | { type: 'stopTask' }
  | { type: 'openSourceControl' }
  | { type: 'openSettings' }
  | { type: 'openAbout' }
  | { type: 'ready' }
  | { type: 'saveProvider'; provider: ProviderId }
  | { type: 'saveHistory'; history: ChatHistoryState }
  | { type: 'getReviewContext'; baseBranch?: string }
  | { type: 'openReviewAgentFile' }
  | { type: 'applyPlan'; mode: TaskMode; model?: string; planPath?: string; provider?: ProviderId }
  | { type: 'rejectPlan'; planPath?: string }
  | { type: 'openPlan'; planPath?: string }
  | { type: 'openSavedPlans' }
  | { type: 'refreshMcpStatus' }
  | { type: 'loginProvider'; providerId: ProviderId }
  | { type: 'resolveDroppedFiles'; paths: string[] }
  | { type: 'openWorkspaceFile'; path: string }
  | { type: 'attachWorkspaceFiles'; paths: string[] }
  | { type: 'getAgentPrompts' }
  | { type: 'reloadAgents' }
  | { type: 'getSkillPrompts' }
  | { type: 'reloadSkills' }
  | { type: 'researchCommand'; action: 'done' | 'current' | 'next' | 'list' | 'reload' }
  | { type: 'compactConversation'; conversationId: string; messages: SerializedChatMessage[]; provider: ProviderId; model?: string }
  | { type: 'openExternal'; url: string }
  // Diff viewer requests
  | { type: 'getFileDiff'; path: string; baseRef?: string }
  | { type: 'getAllDiffs'; baseRef?: string }
  | { type: 'openDiffEditor'; path: string; baseRef?: string }
  | { type: 'openFileFromDiff'; path: string; line?: number }
  | { type: 'revertFileChange'; path: string }
  | { type: 'refreshGitDiff' }
  // Artifact requests
  | { type: 'listArtifacts'; conversationId?: string; taskId?: string }
  | { type: 'openArtifact'; artifactId: string }
  | { type: 'previewArtifact'; artifactId: string }
  | { type: 'revealArtifactInExplorer'; artifactId: string }
  | { type: 'deleteArtifact'; artifactId: string }
  | { type: 'rescanArtifacts' }
  // Code block actions
  | { type: 'insertCodeIntoActiveFile'; code: string; language?: string }
  | { type: 'createFileFromCode'; code: string; language?: string; suggestedName?: string }
  | { type: 'runCodeBlockCommand'; command: string }
  // Analytics requests
  | { type: 'getAnalyticsSummary'; query?: AnalyticsQuery }
  | { type: 'getAnalyticsRuns'; query?: AnalyticsQuery }
  | { type: 'submitRunFeedback'; taskId: string; feedback: AnalyticsFeedback; reason?: string }
  | { type: 'exportAnalytics'; format: 'json' | 'csv' | 'markdown'; query?: AnalyticsQuery }
  | { type: 'clearAnalytics' }
  // Agent Mode requests (webview → extension)
  | { type: 'approveAgentPlan'; sessionId: string }
  | { type: 'rejectAgentPlan'; sessionId: string; reason?: string }
  | { type: 'approveAgentCommand'; sessionId: string; requestId: string }
  | { type: 'rejectAgentCommand'; sessionId: string; requestId: string; reason?: string }
  | { type: 'openAgentSession'; sessionId: string }
  | { type: 'listAgentSessions' }
  // Code Review requests (webview → extension)
  | { type: 'runCodeReview'; target: CodeReviewTarget; preset: CodeReviewPreset; userPrompt?: string }
  | { type: 'openReviewFinding'; findingId: string; filePath?: string; line?: number }
  | { type: 'copyReviewFinding'; findingId: string }
  | { type: 'applyCodeReviewFix'; reportId: string; findingId: string }
  | { type: 'exportCodeReviewReport'; reportId: string }
