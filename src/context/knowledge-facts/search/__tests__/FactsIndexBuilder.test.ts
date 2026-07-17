import { describe, it, expect } from 'vitest';
import { FactsIndexBuilder, isRetrievable } from '../FactsIndexBuilder';
import type { KnowledgeFact } from '../../types';

function makeFact(overrides: Partial<KnowledgeFact> = {}): KnowledgeFact {
  return {
    version: 1,
    schemaVersion: 'knowledge-fact-v1',
    id: 'id-1',
    canonicalKey: 'key-1',
    kind: 'lesson',
    subject: 'Foo',
    statement: 'bar',
    confidence: 0.9,
    status: 'verified',
    evidence: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspaceRoot: '/tmp/ws',
    ...overrides,
  };
}

describe('isRetrievable', () => {
  it('excludes rejected, stale, and superseded facts', () => {
    expect(isRetrievable(makeFact({ status: 'rejected' }))).toBe(false);
    expect(isRetrievable(makeFact({ status: 'stale' }))).toBe(false);
    expect(isRetrievable(makeFact({ status: 'superseded' }))).toBe(false);
  });

  it('excludes low-confidence candidates', () => {
    expect(isRetrievable(makeFact({ status: 'candidate', confidence: 0.5 }))).toBe(false);
  });

  it('includes candidates at or above the confidence threshold', () => {
    expect(isRetrievable(makeFact({ status: 'candidate', confidence: 0.65 }))).toBe(true);
    expect(isRetrievable(makeFact({ status: 'candidate', confidence: 0.9 }))).toBe(true);
  });

  it('includes verified facts regardless of confidence', () => {
    expect(isRetrievable(makeFact({ status: 'verified', confidence: 0.1 }))).toBe(true);
  });
});

describe('FactsIndexBuilder', () => {
  it('excludes non-retrievable facts from the index', () => {
    const facts = [
      makeFact({ status: 'verified' }),
      makeFact({ status: 'rejected' }),
      makeFact({ status: 'candidate', confidence: 0.5 }),
    ];
    const index = new FactsIndexBuilder().build(facts);
    expect(index.documents).toHaveLength(1);
  });

  it('produces non-empty tokens for a retrievable fact', () => {
    const index = new FactsIndexBuilder().build([makeFact()]);
    expect(index.documents[0].tokens.length).toBeGreaterThan(0);
  });

  it('handles an empty input list', () => {
    const index = new FactsIndexBuilder().build([]);
    expect(index.documents).toHaveLength(0);
    expect(index.stats.totalDocs).toBe(0);
  });
});
