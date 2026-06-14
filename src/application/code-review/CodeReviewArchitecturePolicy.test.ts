import { describe, it, expect } from 'vitest';
import { CodeReviewArchitecturePolicy } from './CodeReviewArchitecturePolicy';
import { CodeReviewPolicy } from './CodeReviewPolicy';
import type { ArchitectureScore } from './CodeReviewArchitectureScore';

const policy = new CodeReviewArchitecturePolicy();
const reviewPolicy = new CodeReviewPolicy();

function makeArchFinding(overrides = {}) {
  return reviewPolicy.normalizeFinding({
    severity: 'major',
    category: 'architecture',
    title: 'Layer violation',
    description: 'Business logic inside UI component',
    evidence: 'Found event dispatch in React component',
    recommendation: 'Move to application layer',
    confidence: 0.9,
    ...overrides,
  });
}

const goodScore: ArchitectureScore = {
  overall: 90, coupling: 85, cohesion: 88, abstraction: 87,
  testability: 92, extensibility: 86, readability: 90, riskLevel: 'low',
};

const badScore: ArchitectureScore = {
  overall: 45, coupling: 40, cohesion: 35, abstraction: 50,
  testability: 42, extensibility: 38, readability: 60, riskLevel: 'high',
};

describe('CodeReviewArchitecturePolicy', () => {
  it('architecture category returns true for isArchitectureCategory', () => {
    expect(policy.isArchitectureCategory('architecture')).toBe(true);
    expect(policy.isArchitectureCategory('coupling')).toBe(true);
    expect(policy.isArchitectureCategory('oop')).toBe(true);
    expect(policy.isArchitectureCategory('style')).toBe(false);
    expect(policy.isArchitectureCategory('bug')).toBe(false);
  });

  it('blocker architecture finding blocks merge', () => {
    const f = makeArchFinding({ severity: 'blocker' });
    expect(policy.shouldBlockMerge(f)).toBe(true);
  });

  it('critical architecture finding blocks merge', () => {
    const f = makeArchFinding({ severity: 'critical' });
    expect(policy.shouldBlockMerge(f)).toBe(true);
  });

  it('major layer violation blocks merge', () => {
    const f = makeArchFinding({
      severity: 'major',
      category: 'architecture',
      description: 'business logic inside ui component dispatch',
      evidence: 'RunAgentUseCase called directly in React component',
    });
    expect(policy.shouldBlockMerge(f)).toBe(true);
  });

  it('major dependency direction violation blocks merge', () => {
    const f = makeArchFinding({ severity: 'major', category: 'dependency-direction' });
    expect(policy.shouldBlockMerge(f)).toBe(true);
  });

  it('minor architecture issue does not block merge', () => {
    const f = makeArchFinding({ severity: 'minor', category: 'cohesion' });
    expect(policy.shouldBlockMerge(f)).toBe(false);
  });

  it('healthy score returns healthy', () => {
    const verdict = policy.calculateArchitectureVerdict([], goodScore);
    expect(verdict).toBe('healthy');
  });

  it('score below 70 returns needs-refactor', () => {
    const midScore: ArchitectureScore = { ...goodScore, overall: 65, riskLevel: 'medium' };
    const verdict = policy.calculateArchitectureVerdict([], midScore);
    expect(verdict).toBe('needs-refactor');
  });

  it('score below 50 returns architecture-blocker', () => {
    const verdict = policy.calculateArchitectureVerdict([], badScore);
    expect(verdict).toBe('architecture-blocker');
  });

  it('score 75-84 returns acceptable-with-debt', () => {
    const debtScore: ArchitectureScore = { ...goodScore, overall: 78, riskLevel: 'medium' };
    const verdict = policy.calculateArchitectureVerdict([], debtScore);
    expect(verdict).toBe('acceptable-with-debt');
  });

  it('architecture score is clamped to 0-100', () => {
    const clamped = policy.clampArchitectureScore({ ...goodScore, overall: 150, coupling: -10 });
    expect(clamped.overall).toBe(100);
    expect(clamped.coupling).toBe(0);
  });

  it('clampScore clamps correctly', () => {
    expect(policy.clampScore(110)).toBe(100);
    expect(policy.clampScore(-5)).toBe(0);
    expect(policy.clampScore(NaN)).toBe(0);
    expect(policy.clampScore(75)).toBe(75);
  });

  it('major coupling debt with no score returns needs-refactor', () => {
    // Use a description that does not trigger the layer violation blocker check
    const f = reviewPolicy.normalizeFinding({
      severity: 'major',
      category: 'coupling',
      title: 'High coupling between modules',
      description: 'Many modules depend on a central utility',
      evidence: 'Import count is high',
      recommendation: 'Introduce an abstraction layer',
      confidence: 0.8,
    });
    const verdict = policy.calculateArchitectureVerdict([f]);
    expect(verdict).toBe('needs-refactor');
  });

  it('no findings and no score returns healthy', () => {
    const verdict = policy.calculateArchitectureVerdict([]);
    expect(verdict).toBe('healthy');
  });
});
