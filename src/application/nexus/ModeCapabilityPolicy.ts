import type { TaskMode } from '../../core/agent/AgentTask';
import type { AgentCapabilities } from '../../core/agent/AgentCapabilities';
import type { NexusStage } from './NexusRoutingPolicy';

export type StageFlow = NexusStage[];

export const MODE_FLOW: Record<TaskMode, StageFlow> = {
  edit:           ['search', 'plan'],
  debug:          ['search', 'plan'],
  test:           ['search', 'plan'],
  review:         ['search', 'plan'],
  research:       ['search'],
  plan:           ['plan'],
  ask:            ['plan'],
  brainstorm:     ['plan'],
  'scan-project': ['search'],
};

export const STAGE_CAPABILITIES: Record<NexusStage, Partial<AgentCapabilities>> = {
  search: { canSearchWeb: true },
  plan:   {},
  code:   { canEditFiles: true },
};

export const CODING_MODES: ReadonlySet<TaskMode> = new Set(['edit', 'debug', 'test', 'review']);

export function isCodingMode(mode: TaskMode): boolean {
  return CODING_MODES.has(mode);
}
