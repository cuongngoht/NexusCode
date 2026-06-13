import { describe, expect, it } from 'vitest';
import { buildDagPlan } from './SubagentDagPlanner';
import type { SubagentDefinition } from './SubagentDefinition';

function makeDef(role: string, dependsOn: string[] = [], canRunInParallel = false): SubagentDefinition {
  return {
    role: role as SubagentDefinition['role'],
    displayName: role,
    promptFile: `subagents/${role}.md`,
    preferredAgentIds: ['codex'],
    applicableModes: ['edit'],
    dependsOn: dependsOn as SubagentDefinition['role'][],
    canRunInParallel,
  };
}

describe('buildDagPlan', () => {
  it('puts search in group 0 with no dependencies', () => {
    const defs = [makeDef('search'), makeDef('planner', ['search'])];
    const plan = buildDagPlan(defs, 2);
    const searchNode = plan.nodes.find(n => n.role === 'search')!;
    const plannerNode = plan.nodes.find(n => n.role === 'planner')!;
    expect(searchNode.parallelGroup).toBe(0);
    expect(plannerNode.parallelGroup).toBeGreaterThan(0);
  });

  it('puts independent roles in same group', () => {
    const defs = [makeDef('search'), makeDef('product'), makeDef('research')];
    const plan = buildDagPlan(defs, 3);
    const groups = plan.nodes.map(n => n.parallelGroup);
    // All in group 0 since none depend on each other
    expect(groups.every(g => g === groups[0])).toBe(true);
  });

  it('respects maxParallel clamping', () => {
    const defs = [makeDef('search'), makeDef('planner', ['search'])];
    expect(buildDagPlan(defs, 99).maxParallel).toBe(4);
    expect(buildDagPlan(defs, 0).maxParallel).toBe(1);
  });

  it('debugger depends on search', () => {
    const defs = [makeDef('search'), makeDef('debugger', ['search'])];
    const plan = buildDagPlan(defs, 2);
    const searchGroup = plan.nodes.find(n => n.role === 'search')!.parallelGroup;
    const debugGroup = plan.nodes.find(n => n.role === 'debugger')!.parallelGroup;
    expect(debugGroup).toBeGreaterThan(searchGroup);
  });

  it('creates parallel groups array', () => {
    const defs = [makeDef('search'), makeDef('product'), makeDef('planner', ['search'])];
    const plan = buildDagPlan(defs, 2);
    expect(plan.parallelGroups.length).toBeGreaterThan(0);
    expect(plan.parallelGroups.flat()).toHaveLength(defs.length);
  });

  it('handles single definition', () => {
    const defs = [makeDef('search')];
    const plan = buildDagPlan(defs, 2);
    expect(plan.nodes).toHaveLength(1);
    expect(plan.parallelGroups[0]).toContain('search');
  });

  it('handles empty definitions', () => {
    const plan = buildDagPlan([], 2);
    expect(plan.nodes).toHaveLength(0);
    expect(plan.parallelGroups).toHaveLength(0);
  });
});
