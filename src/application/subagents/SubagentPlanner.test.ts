import { describe, expect, it } from 'vitest';
import { SubagentRegistry } from './SubagentRegistry';
import { SubagentPlanner } from './SubagentPlanner';
import { DEFAULT_SUBAGENTS } from './DefaultSubagents';

function makeRegistry(): SubagentRegistry {
  const r = new SubagentRegistry();
  DEFAULT_SUBAGENTS.forEach(d => r.register(d));
  return r;
}

describe('SubagentPlanner', () => {
  it('returns subagents applicable to the mode', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false });
    expect(result.every(d => d.applicableModes.includes('edit'))).toBe(true);
  });

  it('excludes security when includeSecurity=false', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false });
    expect(result.map(d => d.role)).not.toContain('security');
  });

  it('includes security when includeSecurity=true', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 10, includeSecurity: true, includeDocs: false });
    expect(result.map(d => d.role)).toContain('security');
  });

  it('excludes docs when includeDocs=false', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'ask', maxRuns: 10, includeSecurity: false, includeDocs: false });
    expect(result.map(d => d.role)).not.toContain('docs');
  });

  it('includes docs when includeDocs=true', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'ask', maxRuns: 10, includeSecurity: false, includeDocs: true });
    expect(result.map(d => d.role)).toContain('docs');
  });

  it('caps results at maxRuns', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 2, includeSecurity: false, includeDocs: false });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array for scan-project mode', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'scan-project', maxRuns: 10, includeSecurity: true, includeDocs: true });
    expect(result).toHaveLength(0);
  });

  it('order is stable across multiple calls with same input', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const cfg = { mode: 'debug' as const, maxRuns: 10, includeSecurity: false, includeDocs: false };
    const a = planner.plan(cfg).map(d => d.role);
    const b = planner.plan(cfg).map(d => d.role);
    expect(a).toEqual(b);
  });

  it('search appears before planner in edit mode', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false });
    const roles = result.map(d => d.role);
    const searchIdx = roles.indexOf('search');
    const plannerIdx = roles.indexOf('planner');
    if (searchIdx !== -1 && plannerIdx !== -1) {
      expect(searchIdx).toBeLessThan(plannerIdx);
    }
  });
});
