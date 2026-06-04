import type { TaskMode } from '../agent/AgentTask';
import type { ProviderId } from '../types';
import type { DebugContext } from '../../debug/DebugContext';

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
  enhancedPrompt: string;
};
