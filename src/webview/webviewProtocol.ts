import { ProviderId, TaskMode, GitFileChange, GitReviewContext } from '../core/types';
import type { PromptAttachment } from '../core/types';
import type { ProviderDetectionResult } from '../core/providerDetector';
import type { ChatHistoryState, SerializedChatMessage, SerializedConversationCompactSummary } from '../core/chat/ChatHistory';
import type { TokenRunUsage } from '../core/tokens/TokenUsage';
import type { AgentModeCapability, AgentRecommendation } from '../application/nexus/AgentCapabilityMatrix';
import type { McpPresetStatusView } from '../mcp/McpTypes';
import type { AgentPrompt } from '../context/agentPromptLibrary';
import type { SkillPrompt } from '../context/skillPromptLibrary';

export type { PromptAttachment };

export type { ProviderDetectionResult };

export type { AgentPrompt };

export type { SkillPrompt };

// Messages sent from the extension to the webview
export type ExtensionMessage =
  | { type: 'stdout'; chunk: string }
  | { type: 'stderr'; chunk: string }
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
  | { type: 'compactSummaryError'; conversationId: string; message: string };

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
  | { type: 'compactConversation'; conversationId: string; messages: SerializedChatMessage[]; provider: ProviderId; model?: string };
