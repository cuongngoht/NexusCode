import { describe, it, expect, vi } from 'vitest';
import { PromoteKnowledgeFactUseCase } from '../PromoteKnowledgeFactUseCase';
import type { EvidenceLivenessChecker } from '../EvidenceLivenessChecker';
import type { IKnowledgeFactsStore, KnowledgeFact, KnowledgeEvidence } from '../../../context/knowledge-facts';

function makeFact(overrides: Partial<KnowledgeFact> = {}): KnowledgeFact {
  return {
    version: 1,
    schemaVersion: 'knowledge-fact-v1',
    id: 'fact-1',
    canonicalKey: 'abc123',
    kind: 'invariant',
    subject: 'IEventBus',
    statement: 'emit is synchronous',
    confidence: 0.6,
    status: 'candidate',
    evidence: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspaceRoot: '/tmp/ws',
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<KnowledgeEvidence> = {}): KnowledgeEvidence {
  return {
    source: 'ai',
    timestamp: Date.now(),
    excerpt: 'observed in code',
    observedBy: 'ai',
    ...overrides,
  };
}

function makeFakeStore() {
  return { write: vi.fn().mockResolvedValue(undefined) } as unknown as IKnowledgeFactsStore;
}

function makeLivenessChecker(aliveMap: Record<string, boolean> = {}) {
  return {
    isAlive: vi.fn().mockImplementation((_ws: string, e: KnowledgeEvidence) => aliveMap[e.taskId ?? ''] ?? true),
  } as unknown as EvidenceLivenessChecker;
}

describe('PromoteKnowledgeFactUseCase', () => {
  it('promotes a candidate to verified when 2 distinct task IDs have live evidence', async () => {
    const fact = makeFact({
      evidence: [makeEvidence({ taskId: 't1' }), makeEvidence({ taskId: 't2' })],
    });
    const store = makeFakeStore();
    const useCase = new PromoteKnowledgeFactUseCase(store, makeLivenessChecker());

    const result = await useCase.execute('/tmp/ws', fact);

    expect(result.status).toBe('verified');
    expect(result.verifiedAt).toBeDefined();
    expect(store.write).toHaveBeenCalledWith('/tmp/ws', result);
  });

  it('does not promote when both evidence entries share the same task ID', async () => {
    const fact = makeFact({
      evidence: [makeEvidence({ taskId: 't1' }), makeEvidence({ taskId: 't1' })],
    });
    const useCase = new PromoteKnowledgeFactUseCase(makeFakeStore(), makeLivenessChecker());

    const result = await useCase.execute('/tmp/ws', fact);
    expect(result.status).toBe('candidate');
  });

  it('evidence without a taskId does not count toward the two-task threshold', async () => {
    const fact = makeFact({
      evidence: [makeEvidence({ taskId: 't1' }), makeEvidence({ taskId: undefined })],
    });
    const useCase = new PromoteKnowledgeFactUseCase(makeFakeStore(), makeLivenessChecker());

    const result = await useCase.execute('/tmp/ws', fact);
    expect(result.status).toBe('candidate');
  });

  it('flips to stale when no evidence is alive', async () => {
    const fact = makeFact({
      status: 'verified',
      evidence: [makeEvidence({ taskId: 't1' })],
    });
    const store = makeFakeStore();
    const useCase = new PromoteKnowledgeFactUseCase(store, makeLivenessChecker({ t1: false }));

    const result = await useCase.execute('/tmp/ws', fact);
    expect(result.status).toBe('stale');
    expect(store.write).toHaveBeenCalled();
  });

  it('does not flip a rejected fact to stale even if all evidence is dead', async () => {
    const fact = makeFact({ status: 'rejected', evidence: [makeEvidence({ taskId: 't1' })] });
    const store = makeFakeStore();
    const useCase = new PromoteKnowledgeFactUseCase(store, makeLivenessChecker({ t1: false }));

    const result = await useCase.execute('/tmp/ws', fact);
    expect(result.status).toBe('rejected');
    expect(store.write).not.toHaveBeenCalled();
  });

  it('leaves an already-verified fact untouched when it still has live evidence', async () => {
    const fact = makeFact({ status: 'verified', evidence: [makeEvidence({ taskId: 't1' })] });
    const store = makeFakeStore();
    const useCase = new PromoteKnowledgeFactUseCase(store, makeLivenessChecker());

    const result = await useCase.execute('/tmp/ws', fact);
    expect(result.status).toBe('verified');
    expect(store.write).not.toHaveBeenCalled();
  });
});
