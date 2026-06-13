import type { TaskMode } from '../agent/AgentTask';
import type { ProviderId, PromptAttachment, SubagentContextEntry } from '../types';
// DebugContext is defined in core/debug (pure domain value object for the 'debug' mode).
// The feature implementation lives in src/debug/ which only re-exports the type.
import type { DebugContext } from '../debug/DebugContext';

export type PipelineContext = {
  readonly workspaceRoot: string;
  readonly originalPrompt: string;
  readonly mode: TaskMode;
  readonly model: string | undefined;
  readonly providerId: ProviderId;
  readonly enableEnhancement: boolean;
  // Enriched by pre-steps:
  projectMap?: string;
  sourceContext?: string;
  conversationContext?: string;
  brainstormAgents?: string;
  debugContext?: DebugContext;
  planContent?: string;
  baseBranch?: string;
  reviewFileContents?: string;
  promptAttachments?: PromptAttachment[];
  attachmentContext?: string;
  subagentResults?: SubagentContextEntry[];
  enhancedPrompt: string;
  autoApprove?: boolean;
  approvedPlanPath?: string;
  approvedPlanContent?: string;
};
