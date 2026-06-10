import type { AgentId } from '../../core/agent/AgentTask';

export type NexusStage = 'search' | 'plan' | 'code';

export const STAGE_PRIORITY: Record<NexusStage, AgentId[]> = {
  search: ['antigravity', 'grok', 'codex', 'claude', 'copilot', 'aider', 'custom'],
  plan:   ['codex',  'claude', 'grok', 'antigravity', 'copilot', 'aider', 'custom'],
  code:   ['claude', 'codex',  'grok', 'aider',  'copilot', 'custom', 'antigravity'],
};
