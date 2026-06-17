import type { TaskMode } from '../agent/AgentTask';
import type { CodeReviewTarget, ProviderId, PromptAttachment, SubagentContextEntry } from '../types';
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
  reviewTarget?: CodeReviewTarget;
  reviewFileContents?: string;
  promptAttachments?: PromptAttachment[];
  attachmentContext?: string;
  subagentResults?: SubagentContextEntry[];
  reviewEmptyDiff?: boolean;
  enhancedPrompt: string;
  codeReviewRawOutput?: string;
  stepWarnings?: Array<{ stepLabel: string; message: string }>;
  isCancellationRequested?: () => boolean;
  autoApprove?: boolean;
  approvedPlanPath?: string;
  approvedPlanContent?: string;
};
