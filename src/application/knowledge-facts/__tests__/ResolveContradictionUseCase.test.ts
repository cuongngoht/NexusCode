import { describe, it, expect, vi } from 'vitest';
import { ResolveContradictionUseCase } from '../ResolveContradictionUseCase';
import type { IKnowledgeFactsStore, KnowledgeFact } from '../../../context/knowledge-facts';

function makeFact(overrides: Partial<KnowledgeFact> = {}): KnowledgeFact {
  return {
    version: 1,
    schemaVersion: 'knowledge-fact-v1',
    id: 'fact-existing',
    canonicalKey: 'existing-key',
    kind: 'contract',
    subject: 'IEventBus.emit',
    statement: 'emit takes one argument',
    confidence: 0.9,
    status: 'verified',
    evidence: [{ source: 'file', timestamp: Date.now(), excerpt: '...', observedBy: 'deterministic' }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspaceRoot: '/tmp/ws',
    ...overrides,
  };
}

function makeFakeStore() {
  return { write: vi.fn().mockResolvedValue(undefined) } as unknown as IKnowledgeFactsStore;
}

describe('ResolveContradictionUseCase', () => {
  it('auto-supersedes an existing candidate fact', async () => {
    const existing = makeFact({ id: 'old', canonicalKey: 'old-key', status: 'candidate' });
    const incoming = makeFact({ id: 'new', canonicalKey: 'new-key', statement: 'emit takes two arguments' });
    const store = makeFakeStore();
    const useCase = new ResolveContradictionUseCase(store);

    const result = await useCase.execute('/tmp/ws', existing, incoming);

    expect(result.action).toBe('auto-supersede');
    expect(result.existing.status).toBe('superseded');
    expect(result.existing.supersededBy).toBe('new');
    expect(store.write).toHaveBeenCalledWith('/tmp/ws', result.existing);
  });

  it('flags for review against an existing verified fact, leaving it untouched', async () => {
    const existing = makeFact({ id: 'old', canonicalKey: 'old-key', status: 'verified' });
    const incoming = makeFact({ id: 'new', canonicalKey: 'new-key', statement: 'emit takes two arguments' });
    const store = makeFakeStore();
    const useCase = new ResolveContradictionUseCase(store);

    const result = await useCase.execute('/tmp/ws', existing, incoming);

    expect(result.action).toBe('flag-for-review');
    expect(result.existing.status).toBe('verified'); // untouched
    expect(result.incoming.reviewRequested).toBe(true);
    expect(result.incoming.contradicts).toContain('old-key');
    expect(store.write).toHaveBeenCalledWith('/tmp/ws', result.incoming);
  });

  it('merges as corroborating evidence for a stale existing fact', async () => {
    const existing = makeFact({ id: 'old', canonicalKey: 'old-key', status: 'stale', confidence: 0.8, evidence: [] });
    const incoming = makeFact({
      id: 'new',
      canonicalKey: 'new-key',
      evidence: [{ source: 'ai', timestamp: Date.now(), excerpt: 'corroborating', observedBy: 'ai' }],
    });
    const store = makeFakeStore();
    const useCase = new ResolveContradictionUseCase(store);

    const result = await useCase.execute('/tmp/ws', existing, incoming);

    expect(result.action).toBe('merge-as-corroborating');
    expect(result.existing.evidence).toHaveLength(1);
    expect(result.existing.confidence).toBeGreaterThan(0.8);
    expect(store.write).toHaveBeenCalledWith('/tmp/ws', result.existing);
  });
});
