import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RetentionSweepUseCase, MAX_EVIDENCE_PER_FACT } from '../RetentionSweepUseCase';
import { JsonKnowledgeFactsStore } from '../../../context/knowledge-facts/JsonKnowledgeFactsStore';
import type { KnowledgeFact, KnowledgeEvidence } from '../../../context/knowledge-facts/types';

let tmp: string;
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-retention-sweep-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeEvidence(overrides: Partial<KnowledgeEvidence> = {}): KnowledgeEvidence {
  return { source: 'ai', timestamp: Date.now(), excerpt: 'e', observedBy: 'ai', ...overrides };
}

function makeFact(canonicalKey: string, overrides: Partial<KnowledgeFact> = {}): KnowledgeFact {
  return {
    version: 1,
    schemaVersion: 'knowledge-fact-v1',
    id: `id-${canonicalKey}`,
    canonicalKey,
    kind: 'lesson',
    subject: 'Foo',
    statement: 'bar',
    confidence: 0.8,
    status: 'candidate',
    evidence: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspaceRoot: tmp,
    ...overrides,
  };
}

describe('RetentionSweepUseCase', () => {
  it('caps evidence at MAX_EVIDENCE_PER_FACT, dropping the oldest (FIFO)', async () => {
    const store = new JsonKnowledgeFactsStore();
    const evidence = Array.from({ length: MAX_EVIDENCE_PER_FACT + 10 }, (_, i) =>
      makeEvidence({ excerpt: `e-${i}`, timestamp: Date.now() }));
    await store.write(tmp, makeFact('k1', { evidence }));

    const result = await new RetentionSweepUseCase(store).execute(tmp);

    expect(result.evidenceTrimmed).toBe(10);
    const fact = await store.read(tmp, 'k1');
    expect(fact?.evidence).toHaveLength(MAX_EVIDENCE_PER_FACT);
    expect(fact?.evidence[0].excerpt).toBe('e-10'); // oldest 10 dropped
    expect(fact?.evidence[fact.evidence.length - 1].excerpt).toBe(`e-${MAX_EVIDENCE_PER_FACT + 9}`);
  });

  it('drops evidence entries older than MAX_EVIDENCE_AGE_DAYS even under the cap', async () => {
    const store = new JsonKnowledgeFactsStore();
    const oldEvidence = makeEvidence({ excerpt: 'old', timestamp: Date.now() - 200 * DAY_MS });
    const freshEvidence = makeEvidence({ excerpt: 'fresh', timestamp: Date.now() });
    await store.write(tmp, makeFact('k2', { evidence: [oldEvidence, freshEvidence] }));

    const result = await new RetentionSweepUseCase(store).execute(tmp);

    expect(result.evidenceTrimmed).toBe(1);
    const fact = await store.read(tmp, 'k2');
    expect(fact?.evidence).toEqual([freshEvidence]);
  });

  it('hard-deletes a stale fact that has been stale for >= STALE_CLEANUP_DAYS', async () => {
    const store = new JsonKnowledgeFactsStore();
    await store.write(tmp, makeFact('k3', { status: 'stale', updatedAt: Date.now() - 91 * DAY_MS }));

    const result = await new RetentionSweepUseCase(store).execute(tmp);

    expect(result.factsDeleted).toBe(1);
    expect(await store.read(tmp, 'k3')).toBeUndefined();
  });

  it('does not delete a stale fact that went stale less than STALE_CLEANUP_DAYS ago', async () => {
    const store = new JsonKnowledgeFactsStore();
    await store.write(tmp, makeFact('k4', { status: 'stale', updatedAt: Date.now() - 10 * DAY_MS }));

    const result = await new RetentionSweepUseCase(store).execute(tmp);

    expect(result.factsDeleted).toBe(0);
    expect(await store.read(tmp, 'k4')).toBeDefined();
  });

  it('does not delete an active candidate/verified fact regardless of age', async () => {
    const store = new JsonKnowledgeFactsStore();
    await store.write(tmp, makeFact('k5', { status: 'verified', updatedAt: Date.now() - 500 * DAY_MS, evidence: [makeEvidence({ timestamp: Date.now() })] }));

    const result = await new RetentionSweepUseCase(store).execute(tmp);

    expect(result.factsDeleted).toBe(0);
    expect(await store.read(tmp, 'k5')).toBeDefined();
  });

  it('is a no-op when there are no facts', async () => {
    const result = await new RetentionSweepUseCase(new JsonKnowledgeFactsStore()).execute(tmp);
    expect(result).toEqual({ evidenceTrimmed: 0, factsDeleted: 0 });
  });
});
