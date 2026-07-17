import { describe, it, expect } from 'vitest';
import { evaluateEnrichmentTrigger } from '../EnrichmentTriggerEvaluator';

describe('evaluateEnrichmentTrigger', () => {
  it('triggers on significant-diff when riskLevel meets the minimum threshold', () => {
    expect(evaluateEnrichmentTrigger({ riskLevel: 'high' }, 'medium')).toBe('significant-diff');
    expect(evaluateEnrichmentTrigger({ riskLevel: 'medium' }, 'medium')).toBe('significant-diff');
  });

  it('does not trigger significant-diff below the minimum threshold', () => {
    expect(evaluateEnrichmentTrigger({ riskLevel: 'low' }, 'medium')).toBeUndefined();
  });

  it('triggers on a confirmed debug root cause', () => {
    expect(evaluateEnrichmentTrigger({ debugRootCauseConfirmed: true })).toBe('debug-root-cause');
  });

  it('triggers on a high-severity review finding', () => {
    expect(evaluateEnrichmentTrigger({ reviewFindingSeverity: 'blocker' })).toBe('review-finding');
    expect(evaluateEnrichmentTrigger({ reviewFindingSeverity: 'critical' })).toBe('review-finding');
    expect(evaluateEnrichmentTrigger({ reviewFindingSeverity: 'major' })).toBe('review-finding');
  });

  it('does not trigger on a low-severity review finding', () => {
    expect(evaluateEnrichmentTrigger({ reviewFindingSeverity: 'minor' })).toBeUndefined();
  });

  it('triggers on a blocking review finding regardless of severity label', () => {
    expect(evaluateEnrichmentTrigger({ reviewFindingBlocking: true, reviewFindingSeverity: 'info' })).toBe('review-finding');
  });

  it('triggers on a test failure', () => {
    expect(evaluateEnrichmentTrigger({ testFailed: true })).toBe('test-failure');
  });

  it('triggers on the architectural-decision heuristic when the text matches', () => {
    expect(evaluateEnrichmentTrigger({ promptOrSummaryText: 'We decided to migrate away from X' })).toBe('architectural-decision');
    expect(evaluateEnrichmentTrigger({ promptOrSummaryText: 'chose Postgres instead of MySQL' })).toBe('architectural-decision');
  });

  it('does not trigger when nothing matches', () => {
    expect(evaluateEnrichmentTrigger({ promptOrSummaryText: 'fixed a typo in the readme' })).toBeUndefined();
    expect(evaluateEnrichmentTrigger({})).toBeUndefined();
  });

  it('returns the first matching trigger in priority order', () => {
    expect(evaluateEnrichmentTrigger({ riskLevel: 'high', testFailed: true }, 'medium')).toBe('significant-diff');
  });
});
