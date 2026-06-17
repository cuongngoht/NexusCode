import { describe, it, expect } from 'vitest';
import { CodeReviewPolicy } from './CodeReviewPolicy';
import type { CodeReviewFinding } from './CodeReviewFinding';

function makeFinding(overrides: Partial<CodeReviewFinding> = {}): CodeReviewFinding {
  // Do NOT pass blocking: false here so policy can decide
  return new CodeReviewPolicy().normalizeFinding({
    severity: 'minor',
    category: 'maintainability',
    title: 'Test finding',
    description: 'Test',
    recommendation: 'Fix it.',
    confidence: 0.8,
    ...overrides,
  });
}

describe('CodeReviewPolicy', () => {
  const policy = new CodeReviewPolicy();

  it('critical finding returns request-changes', () => {
    const f = makeFinding({ severity: 'critical', category: 'bug' });
    expect(policy.calculateVerdict([f])).toBe('request-changes');
  });

  it('blocker finding returns request-changes', () => {
    const f = makeFinding({ severity: 'blocker', category: 'security' });
    expect(policy.calculateVerdict([f])).toBe('request-changes');
  });

  it('security major is blocking', () => {
    const f = policy.normalizeFinding({ severity: 'major', category: 'security', title: 'SQL injection', description: 'test', recommendation: 'fix' });
    expect(f.blocking).toBe(true);
    expect(policy.calculateVerdict([f])).toBe('request-changes');
  });

  it('style nit is not blocking', () => {
    const f = policy.normalizeFinding({ severity: 'nit', category: 'style', title: 'Formatting', description: 'minor style', recommendation: 'fix style' });
    expect(f.blocking).toBe(false);
  });

  it('empty findings returns approve', () => {
    expect(policy.calculateVerdict([])).toBe('approve');
  });

  it('nit-only findings return approve', () => {
    const f = makeFinding({ severity: 'nit', category: 'style' });
    // nit/style findings should not be blocking
    expect(f.blocking).toBe(false);
    expect(policy.calculateVerdict([f])).toBe('approve');
  });

  it('major non-blocking finding returns approve-with-comments', () => {
    const f = policy.normalizeFinding({ severity: 'major', category: 'maintainability', title: 'Large class', description: 'test', recommendation: 'split it', blocking: false });
    // Override blocking explicitly to false
    f.blocking = false;
    expect(policy.calculateVerdict([f])).toBe('approve-with-comments');
  });

  it('confidence is clamped between 0 and 1', () => {
    expect(policy.clampConfidence(1.5)).toBe(1);
    expect(policy.clampConfidence(-0.5)).toBe(0);
    expect(policy.clampConfidence(NaN)).toBe(0.7);
    expect(policy.clampConfidence(0.8)).toBe(0.8);
  });

  it('duplicate findings are deduped', () => {
    const f1 = makeFinding({ filePath: 'foo.ts', lineStart: 10, title: 'Same', severity: 'minor', blocking: false });
    const f2 = { ...f1, id: 'different-id' };
    const result = policy.dedupeFindings([f1, f2]);
    expect(result).toHaveLength(1);
  });

  it('findings are sorted by severity (blocker first)', () => {
    const f1 = makeFinding({ severity: 'info', category: 'docs', title: 'Info' });
    const f2 = makeFinding({ severity: 'blocker', category: 'security', title: 'Blocker' });
    const f3 = makeFinding({ severity: 'major', category: 'bug', title: 'Major' });
    const sorted = policy.sortFindings([f1, f2, f3]);
    expect(sorted[0].severity).toBe('blocker');
    expect(sorted[1].severity).toBe('major');
    expect(sorted[2].severity).toBe('info');
  });

  it('normalizeFinding assigns id when missing', () => {
    const f = policy.normalizeFinding({ title: 'No id', description: 'test', recommendation: 'fix' });
    expect(f.id).toBeTruthy();
  });

  it('normalizeFinding defaults confidence to 0.7 when missing', () => {
    const f = policy.normalizeFinding({ title: 'No confidence', description: 'test', recommendation: 'fix' });
    expect(f.confidence).toBe(0.7);
  });

  it('calculateStats counts correctly', () => {
    const findings = [
      makeFinding({ severity: 'blocker', category: 'security' }),
      makeFinding({ severity: 'major', category: 'architecture' }),
      makeFinding({ severity: 'info', category: 'style' }),
    ];
    const stats = policy.calculateStats(findings);
    expect(stats.totalFindings).toBe(3);
    expect(stats.blocker).toBe(1);
    expect(stats.major).toBe(1);
    expect(stats.info).toBe(1);
    expect(stats.security).toBe(1);
    expect(stats.architecture).toBe(1);
  });
});
