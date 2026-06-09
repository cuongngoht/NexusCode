import type { AgentId } from '../../core/agent/AgentTask';

export type NexusStage = 'search' | 'plan' | 'code';

export const STAGE_PRIORITY: Record<NexusStage, AgentId[]> = {
  search: ['antigravity', 'codex', 'claude', 'copilot', 'aider', 'custom'],
  plan:   ['codex',  'claude', 'antigravity', 'copilot', 'aider', 'custom'],
  code:   ['claude', 'codex',  'aider',  'copilot', 'custom', 'antigravity'],
};
