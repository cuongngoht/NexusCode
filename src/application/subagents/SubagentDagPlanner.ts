import type { SubagentRole } from './SubagentResultStore';
import type { SubagentDefinition } from './SubagentDefinition';

export interface SubagentPlanNode {
  id: string;
  role: SubagentRole;
  dependsOn: SubagentRole[];
  parallelGroup: number;
  required: boolean;
  reason: string;
}

export interface SubagentDagPlan {
  nodes: SubagentPlanNode[];
  parallelGroups: SubagentRole[][];
  maxParallel: number;
}

// Build dependency graph from planned definitions
export function buildDagPlan(
  definitions: SubagentDefinition[],
  maxParallel: number,
): SubagentDagPlan {
  const clampedParallel = Math.max(1, Math.min(Math.floor(maxParallel), 4));

  if (definitions.length === 0) {
    return { nodes: [], parallelGroups: [], maxParallel: clampedParallel };
  }

  const roles = new Set(definitions.map(d => d.role));

  // Build effective dependency map (only deps that are actually planned)
  const depMap = new Map<SubagentRole, SubagentRole[]>();
  for (const def of definitions) {
    const deps = (def.dependsOn ?? []).filter(d => roles.has(d));
    depMap.set(def.role, deps);
  }

  // Topological sort → parallel groups
  const assigned = new Map<SubagentRole, number>();
  const remaining = new Set(definitions.map(d => d.role));

  let groupIndex = 0;
  while (remaining.size > 0) {
    // Find roles whose dependencies are all assigned
    const ready: SubagentRole[] = [];
    for (const role of remaining) {
      const deps = depMap.get(role) ?? [];
      if (deps.every(d => assigned.has(d))) {
        ready.push(role);
      }
    }

    if (ready.length === 0) {
      // Cycle or unresolvable — add remainder to last group
      for (const role of remaining) {
        assigned.set(role, groupIndex);
      }
      break;
    }

    for (const role of ready) {
      assigned.set(role, groupIndex);
      remaining.delete(role);
    }
    groupIndex++;
  }

  // Build nodes
  const nodes: SubagentPlanNode[] = definitions.map(def => ({
    id: `${def.role}-${Date.now()}`,
    role: def.role,
    dependsOn: depMap.get(def.role) ?? [],
    parallelGroup: assigned.get(def.role) ?? 0,
    required: def.role === 'search', // search is required; others are optional
    reason: def.displayName,
  }));

  // Build parallel groups array
  const maxGroup = Math.max(...nodes.map(n => n.parallelGroup), 0);
  const parallelGroups: SubagentRole[][] = [];
  for (let i = 0; i <= maxGroup; i++) {
    parallelGroups.push(nodes.filter(n => n.parallelGroup === i).map(n => n.role));
  }

  return { nodes, parallelGroups, maxParallel: clampedParallel };
}
