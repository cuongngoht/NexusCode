import { describe, it, expect } from 'vitest';
import { FactsRagFacade } from '../FactsRagFacade';
import type { KnowledgeFact } from '../../types';

function makeFact(overrides: Partial<KnowledgeFact> = {}): KnowledgeFact {
  return {
    version: 1,
    schemaVersion: 'knowledge-fact-v1',
    id: 'id-1',
    canonicalKey: 'key-1',
    kind: 'invariant',
    subject: 'IEventBus',
    statement: 'emit is synchronous and fire-and-forget',
    confidence: 0.9,
    status: 'verified',
    evidence: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspaceRoot: '/tmp/ws',
    ...overrides,
  };
}

describe('FactsRagFacade', () => {
  it('returns empty string for an empty query', () => {
    const result = new FactsRagFacade().build([makeFact()], '');
    expect(result).toBe('');
  });

  it('returns empty string when no facts score above minScore', () => {
    const result = new FactsRagFacade().build([makeFact()], 'completely unrelated banana recipe');
    expect(result).toBe('');
  });

  it('surfaces a verified fact matching the query, with no candidate label', () => {
    const result = new FactsRagFacade().build([makeFact()], 'IEventBus emit synchronous');
    expect(result).toContain('IEventBus');
    expect(result).not.toContain('not yet confirmed');
  });

  it('labels a candidate fact as not yet confirmed with its confidence percentage', () => {
    const facts = [makeFact({ status: 'candidate', confidence: 0.7 })];
    const result = new FactsRagFacade().build(facts, 'IEventBus emit synchronous');
    expect(result).toContain('not yet confirmed');
    expect(result).toContain('70%');
  });

  it('excludes rejected/stale/superseded facts from results entirely', () => {
    const facts = [makeFact({ status: 'stale' })];
    const result = new FactsRagFacade().build(facts, 'IEventBus emit synchronous');
    expect(result).toBe('');
  });

  it('respects maxChars', () => {
    const facts = Array.from({ length: 20 }, (_, i) =>
      makeFact({ canonicalKey: `key-${i}`, subject: `Subject${i}`, statement: 'emit is synchronous and fire-and-forget' }));
    const result = new FactsRagFacade().build(facts, 'emit synchronous', { maxChars: 100 });
    expect(result.length).toBeLessThanOrEqual(100);
  });
});
