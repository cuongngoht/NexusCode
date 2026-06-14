import { describe, expect, it } from 'vitest';
import {
  clampHardCap,
  clampSubagentCount,
  clampMaxParallel,
  normalizeSelectedRoles,
  SUBAGENT_PRESET_DEFAULTS,
} from './SubagentPresetPolicy';

describe('clampHardCap', () => {
  it('clamps to max 8', () => expect(clampHardCap(99)).toBe(8));
  it('clamps to min 1', () => expect(clampHardCap(0)).toBe(1));
  it('returns 6 for undefined', () => expect(clampHardCap(undefined)).toBe(6));
  it('returns 6 for NaN', () => expect(clampHardCap(NaN)).toBe(6));
  it('floors non-integers', () => expect(clampHardCap(7.9)).toBe(7));
  it('accepts valid value', () => expect(clampHardCap(6)).toBe(6));
});

describe('clampSubagentCount', () => {
  it('clamps to hardCap', () => expect(clampSubagentCount(10, 6)).toBe(6));
  it('clamps to 0 for negative', () => expect(clampSubagentCount(-1, 6)).toBe(0));
  it('returns min(4, hardCap) for undefined', () => expect(clampSubagentCount(undefined, 6)).toBe(4));
  it('returns hardCap when hardCap < 4 and undefined', () => expect(clampSubagentCount(undefined, 2)).toBe(2));
  it('accepts valid value within hardCap', () => expect(clampSubagentCount(3, 6)).toBe(3));
});

describe('clampMaxParallel', () => {
  it('clamps to max 4', () => expect(clampMaxParallel(99)).toBe(4));
  it('clamps to min 1', () => expect(clampMaxParallel(0)).toBe(1));
  it('returns 2 for undefined', () => expect(clampMaxParallel(undefined)).toBe(2));
  it('accepts valid value', () => expect(clampMaxParallel(2)).toBe(2));
});

describe('normalizeSelectedRoles', () => {
  it('filters unknown roles', () => {
    expect(normalizeSelectedRoles(['search', 'unknown_role'])).toEqual(['search']);
  });
  it('deduplicates roles', () => {
    expect(normalizeSelectedRoles(['search', 'search', 'planner'])).toEqual(['search', 'planner']);
  });
  it('returns empty for undefined', () => expect(normalizeSelectedRoles(undefined)).toEqual([]));
  it('accepts all valid roles', () => {
    const result = normalizeSelectedRoles(['search', 'planner', 'coder', 'debugger', 'tester', 'reviewer', 'security', 'docs', 'product', 'research', 'architect']);
    expect(result).toHaveLength(11);
  });
});

describe('SUBAGENT_PRESET_DEFAULTS', () => {
  it('fast has maxRuns 2', () => expect(SUBAGENT_PRESET_DEFAULTS.fast.maxRuns).toBe(2));
  it('balanced has maxRuns 4', () => expect(SUBAGENT_PRESET_DEFAULTS.balanced.maxRuns).toBe(4));
  it('full has maxRuns 6', () => expect(SUBAGENT_PRESET_DEFAULTS.full.maxRuns).toBe(6));
  it('safe has maxRuns 6', () => expect(SUBAGENT_PRESET_DEFAULTS.safe.maxRuns).toBe(6));
  it('safe includes security', () => expect(SUBAGENT_PRESET_DEFAULTS.safe.includeSecurity).toBe(true));
  it('balanced does not include security', () => expect(SUBAGENT_PRESET_DEFAULTS.balanced.includeSecurity).toBe(false));
});
