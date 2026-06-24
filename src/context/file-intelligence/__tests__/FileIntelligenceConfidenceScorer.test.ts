import { describe, it, expect } from 'vitest';
import { FileIntelligenceConfidenceScorer } from '../FileIntelligenceConfidenceScorer';
import type { FileTouchEvent } from '../types';

function makeEvent(overrides: Partial<FileTouchEvent> = {}): FileTouchEvent {
  return {
    filePath: 'src/foo.ts',
    workspaceRoot: '/workspace',
    mode: 'edit',
    reason: 'edit',
    source: 'edit',
    confidence: 0,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('FileIntelligenceConfidenceScorer', () => {
  const scorer = new FileIntelligenceConfidenceScorer();

  it('scores review source as 0.8', () => {
    expect(scorer.score(makeEvent({ source: 'review', reason: 'review' }))).toBe(0.8);
  });

  it('scores debug + confirmed finding as 0.9', () => {
    const event = makeEvent({
      source: 'debug',
      reason: 'debug',
      debugFindings: [{ role: 'confirmed', description: 'null pointer' }],
    });
    expect(scorer.score(event)).toBe(0.9);
  });

  it('scores debug + only suspected findings as 0.5', () => {
    const event = makeEvent({
      source: 'debug',
      reason: 'debug',
      debugFindings: [{ role: 'suspected', description: 'might be here' }],
    });
    expect(scorer.score(event)).toBe(0.5);
  });

  it('scores debug with no findings as 0.5', () => {
    expect(scorer.score(makeEvent({ source: 'debug', reason: 'debug' }))).toBe(0.5);
  });

  it('scores edit source as 0.7', () => {
    expect(scorer.score(makeEvent({ source: 'edit', reason: 'edit' }))).toBe(0.7);
  });

  it('scores test source as 0.75', () => {
    expect(scorer.score(makeEvent({ source: 'test', reason: 'test' }))).toBe(0.75);
  });

  it('scores subagent source as 0.6', () => {
    expect(scorer.score(makeEvent({ source: 'subagent', reason: 'subagent' }))).toBe(0.6);
  });

  it('scores chat/plan source as 0.2', () => {
    expect(scorer.score(makeEvent({ source: 'chat', reason: 'context-read' }))).toBe(0.2);
    expect(scorer.score(makeEvent({ source: 'plan', reason: 'context-read' }))).toBe(0.2);
  });

  it('merge caps at 0.95', () => {
    const merged = scorer.merge(0.9, 0.9);
    expect(merged).toBeLessThanOrEqual(0.95);
  });

  it('merge raises confidence when incoming is higher', () => {
    const merged = scorer.merge(0.3, 0.8);
    expect(merged).toBeGreaterThan(0.3);
  });
});
