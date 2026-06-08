import type { AgentId } from '../../core/agent/AgentTask';
import type { TaskMode } from '../../core/types';
import type { SubagentRole } from './SubagentResultStore';

export interface SubagentDefinition {
  readonly role: SubagentRole;
  readonly displayName: string;
  /** Path relative to extension media dir, e.g. "subagents/search.md" */
  readonly promptFile: string;
  /** Preferred agent IDs in priority order; first available wins */
  readonly preferredAgentIds: ReadonlyArray<AgentId>;
  readonly applicableModes: ReadonlyArray<TaskMode>;
}
