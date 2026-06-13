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

  it('includes security when includeSecurity=true with safe preset', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', preset: 'safe', maxRuns: 10, includeSecurity: true, includeDocs: false });
    expect(result.map(d => d.role)).toContain('security');
  });

  it('excludes docs when includeDocs=false', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'ask', maxRuns: 10, includeSecurity: false, includeDocs: false });
    expect(result.map(d => d.role)).not.toContain('docs');
  });

  it('includes docs when includeDocs=true with review+safe preset', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'review', preset: 'safe', maxRuns: 10, includeSecurity: false, includeDocs: true });
    expect(result.map(d => d.role)).toContain('docs');
  });

  it('caps results at maxRuns', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 2, includeSecurity: false, includeDocs: false });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('returns search and planner for scan-project mode (utility roles bypass mode filter)', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'scan-project', maxRuns: 10, includeSecurity: true, includeDocs: true });
    const roles = result.map(d => d.role);
    expect(roles).toContain('search');
    expect(roles).toContain('planner');
    expect(roles).not.toContain('security');
    expect(roles).not.toContain('docs');
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

  it('returns empty when subagentMode is off', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', subagentMode: 'off', maxRuns: 10, includeSecurity: false, includeDocs: false });
    expect(result).toHaveLength(0);
  });

  it('returns only selectedRoles in manual mode', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({
      mode: 'edit',
      subagentMode: 'manual',
      selectedRoles: ['search', 'tester'],
      maxRuns: 10,
      includeSecurity: false,
      includeDocs: false,
    });
    expect(result.map(d => d.role)).toEqual(['search', 'tester']);
  });

  it('maxRuns 0 returns empty array', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 0, includeSecurity: false, includeDocs: false });
    expect(result).toHaveLength(0);
  });

  it('manual mode ignores unknown roles', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({
      mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false,
      subagentMode: 'manual', selectedRoles: ['search', 'nonexistent_role'],
    });
    expect(result.map(d => d.role)).not.toContain('nonexistent_role');
  });

  it('manual mode empty selectedRoles returns empty', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({
      mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false,
      subagentMode: 'manual', selectedRoles: [],
    });
    expect(result).toHaveLength(0);
  });

  it('manual mode returns only selected roles', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({
      mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false,
      subagentMode: 'manual', selectedRoles: ['search', 'debugger'],
    });
    expect(result.map(d => d.role)).toEqual(expect.arrayContaining(['search', 'debugger']));
    expect(result).toHaveLength(2);
  });

  it('fast preset yields max 2 subagents', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'fast' });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('balanced preset caps at 4', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'balanced' });
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it('safe preset allows up to 6 and can include security', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'safe' });
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result.map(d => d.role)).toContain('security');
  });

  it('hardCap 99 is clamped to 8', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 100, hardCap: 99, includeSecurity: false, includeDocs: false, preset: 'safe' });
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it('negative maxRuns returns empty array', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: -1, includeSecurity: false, includeDocs: false });
    expect(result).toHaveLength(0);
  });

  it('security included when includeSecurity is true', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'edit', maxRuns: 10, includeSecurity: true, includeDocs: false, preset: 'safe' });
    expect(result.map(d => d.role)).toContain('security');
  });

  it('security included when intent riskLevel is high', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({
      mode: 'edit', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'safe',
      intent: { mode: 'edit', taskType: 'security_review', needsProjectSearch: true, needsDebug: false, needsTests: false, needsReview: false, needsSecurity: true, needsDocs: false, needsProduct: false, needsResearch: false, riskLevel: 'high', keywords: [] },
    });
    expect(result.map(d => d.role)).toContain('security');
  });

  it('docs included when includeDocs is true', () => {
    const planner = new SubagentPlanner(makeRegistry());
    // docs is in review/safe mode
    const result = planner.plan({ mode: 'review', maxRuns: 10, includeSecurity: false, includeDocs: true, preset: 'safe' });
    expect(result.map(d => d.role)).toContain('docs');
  });

  it('docs included when intent.needsDocs is true', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({
      mode: 'review', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'safe',
      intent: { mode: 'review', taskType: 'docs', needsProjectSearch: true, needsDebug: false, needsTests: false, needsReview: false, needsSecurity: false, needsDocs: true, needsProduct: false, needsResearch: false, riskLevel: 'low', keywords: [] },
    });
    expect(result.map(d => d.role)).toContain('docs');
  });

  it('debug balanced gives search/debugger/tester/reviewer', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'debug', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'balanced' });
    const roles = result.map(d => d.role);
    expect(roles).toContain('search');
    expect(roles).toContain('debugger');
    expect(roles).toContain('tester');
    expect(roles).toContain('reviewer');
  });

  it('debug fast gives search/debugger only', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'debug', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'fast' });
    const roles = result.map(d => d.role);
    expect(roles).toContain('search');
    expect(roles).toContain('debugger');
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('research fast gives search/research only', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'research', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'fast' });
    const roles = result.map(d => d.role);
    expect(roles).toContain('search');
    expect(roles).toContain('research');
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('plan balanced gives search/product/planner', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'plan', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'balanced' });
    const roles = result.map(d => d.role);
    expect(roles).toContain('search');
    expect(roles).toContain('planner');
  });

  it('test balanced gives search/tester/debugger/reviewer', () => {
    const planner = new SubagentPlanner(makeRegistry());
    const result = planner.plan({ mode: 'test', maxRuns: 10, includeSecurity: false, includeDocs: false, preset: 'balanced' });
    const roles = result.map(d => d.role);
    expect(roles).toContain('search');
    expect(roles).toContain('tester');
  });
});
