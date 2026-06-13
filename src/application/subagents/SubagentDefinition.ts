import type { AgentId } from '../../core/agent/AgentTask';
import type { TaskMode } from '../../core/types';
import type { SubagentRole } from './SubagentResultStore';

export type SubagentCapability =
  | 'project_search' | 'root_cause_analysis' | 'implementation_planning'
  | 'implementation' | 'test_design' | 'code_review' | 'security_review'
  | 'documentation_review' | 'product_requirements' | 'research' | 'synthesis';

export interface SubagentDefinition {
  readonly role: SubagentRole;
  readonly displayName: string;
  /** Path relative to extension media dir, e.g. "subagents/search.md" */
  readonly promptFile: string;
  /** Preferred agent IDs in priority order; first available wins */
  readonly preferredAgentIds: ReadonlyArray<AgentId>;
  readonly applicableModes: ReadonlyArray<TaskMode>;
  readonly capabilities?: ReadonlyArray<SubagentCapability>;
  readonly costWeight?: number;
  readonly latencyWeight?: number;
  readonly confidenceThreshold?: number;
  readonly canRunInParallel?: boolean;
  readonly dependsOn?: ReadonlyArray<SubagentRole>;
  readonly outputSchema?: string;
}
