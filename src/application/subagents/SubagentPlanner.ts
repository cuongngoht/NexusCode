import type { TaskMode } from '../../core/types';
import type { SubagentDefinition } from './SubagentDefinition';
import type { SubagentRole } from './SubagentResultStore';
import type { SubagentRegistry } from './SubagentRegistry';

export interface SubagentPlanConfig {
  mode: TaskMode;
  maxRuns: number;
  includeSecurity: boolean;
  includeDocs: boolean;
}

const ROLE_PRIORITY: SubagentRole[] = [
  'search',
  'research',
  'planner',
  'debugger',
  'tester',
  'reviewer',
  'security',
  'docs',
  'product',
];

export class SubagentPlanner {
  constructor(private readonly registry: SubagentRegistry) {}

  plan(cfg: SubagentPlanConfig): SubagentDefinition[] {
    const all = this.registry.getAll();

    const filtered = all.filter(def => {
      if (!def.applicableModes.includes(cfg.mode)) return false;
      if (def.role === 'security' && !cfg.includeSecurity) return false;
      if (def.role === 'docs' && !cfg.includeDocs) return false;
      return true;
    });

    // Stable sort by ROLE_PRIORITY
    filtered.sort((a, b) => {
      const ai = ROLE_PRIORITY.indexOf(a.role);
      const bi = ROLE_PRIORITY.indexOf(b.role);
      const aIdx = ai === -1 ? ROLE_PRIORITY.length : ai;
      const bIdx = bi === -1 ? ROLE_PRIORITY.length : bi;
      return aIdx - bIdx;
    });

    return filtered.slice(0, Math.max(0, cfg.maxRuns));
  }
}
