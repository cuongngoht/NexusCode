import { describe, it, expect } from 'vitest';
import { boostRisk, levelForScore } from '../RiskScoreEngine';

describe('levelForScore', () => {
  it('maps score ranges to levels', () => {
    expect(levelForScore(0)).toBe('low');
    expect(levelForScore(25)).toBe('low');
    expect(levelForScore(26)).toBe('medium');
    expect(levelForScore(50)).toBe('medium');
    expect(levelForScore(51)).toBe('high');
    expect(levelForScore(75)).toBe('high');
    expect(levelForScore(76)).toBe('critical');
  });
});

describe('boostRisk', () => {
  it('adds score, recomputes level, and appends factors', () => {
    const boosted = boostRisk(
      { level: 'low', score: 20, factors: ['Minor change: 60 lines'] },
      15,
      ['Architecture drift: 1 new layer violation(s)'],
    );
    expect(boosted.score).toBe(35);
    expect(boosted.level).toBe('medium');
    expect(boosted.factors).toEqual([
      'Minor change: 60 lines',
      'Architecture drift: 1 new layer violation(s)',
    ]);
  });

  it('caps the boosted score at 100', () => {
    const boosted = boostRisk({ level: 'critical', score: 95, factors: [] }, 30, []);
    expect(boosted.score).toBe(100);
    expect(boosted.level).toBe('critical');
  });

  it('returns equal values for a zero boost', () => {
    const original = { level: 'medium' as const, score: 40, factors: ['x'] };
    const boosted = boostRisk(original, 0, []);
    expect(boosted.score).toBe(40);
    expect(boosted.level).toBe('medium');
    expect(boosted.factors).toEqual(['x']);
  });
});
