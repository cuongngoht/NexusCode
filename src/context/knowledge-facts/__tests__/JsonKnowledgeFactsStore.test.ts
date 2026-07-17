import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { JsonKnowledgeFactsStore } from '../JsonKnowledgeFactsStore';
import { buildCanonicalKey } from '../CanonicalKeyBuilder';
import type { KnowledgeFact } from '../types';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-facts-store-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeFact(overrides: Partial<KnowledgeFact> = {}): KnowledgeFact {
  const canonicalKey = overrides.canonicalKey ?? buildCanonicalKey('invariant', 'IEventBus', 'emit is synchronous');
  return {
    version: 1,
    schemaVersion: 'knowledge-fact-v1',
    id: 'fact-1',
    canonicalKey,
    kind: 'invariant',
    subject: 'IEventBus',
    statement: 'emit is synchronous',
    confidence: 0.9,
    status: 'verified',
    evidence: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspaceRoot: tmp,
    ...overrides,
  };
}

describe('JsonKnowledgeFactsStore', () => {
  it('writes and reads a fact roundtrip', async () => {
    const store = new JsonKnowledgeFactsStore();
    const fact = makeFact();
    await store.write(tmp, fact);

    const loaded = await store.read(tmp, fact.canonicalKey);
    expect(loaded).toEqual(fact);
  });

  it('leaves no leftover .tmp files after write', async () => {
    const store = new JsonKnowledgeFactsStore();
    await store.write(tmp, makeFact());

    const dir = path.join(tmp, '.nexus', 'knowledge-base', 'facts');
    const files = fs.readdirSync(dir);
    expect(files.some(f => f.endsWith('.tmp'))).toBe(false);
  });

  it('upserts the same canonicalKey to the same file (re-derivation maps to the same file)', async () => {
    const store = new JsonKnowledgeFactsStore();
    const fact = makeFact({ confidence: 0.5 });
    await store.write(tmp, fact);
    await store.write(tmp, { ...fact, confidence: 0.95, updatedAt: Date.now() + 1 });

    const dir = path.join(tmp, '.nexus', 'knowledge-base', 'facts');
    const jsonFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');
    expect(jsonFiles).toHaveLength(1);

    const loaded = await store.read(tmp, fact.canonicalKey);
    expect(loaded?.confidence).toBe(0.95);
  });

  it('updates the index on write', async () => {
    const store = new JsonKnowledgeFactsStore();
    const fact = makeFact();
    await store.write(tmp, fact);

    const index = await store.readIndex(tmp);
    expect(index?.facts).toHaveLength(1);
    expect(index?.facts[0].canonicalKey).toBe(fact.canonicalKey);
  });

  it('listAll falls back to a directory scan when the index is missing', async () => {
    const store = new JsonKnowledgeFactsStore();
    const fact = makeFact();
    await store.write(tmp, fact);

    // Simulate a lost/corrupted index
    fs.rmSync(path.join(tmp, '.nexus', 'knowledge-base', 'facts', 'index.json'));

    const all = await store.listAll(tmp);
    expect(all).toHaveLength(1);
    expect(all[0].canonicalKey).toBe(fact.canonicalKey);
  });

  it('delete removes the fact file and its index entry', async () => {
    const store = new JsonKnowledgeFactsStore();
    const fact = makeFact();
    await store.write(tmp, fact);

    await store.delete(tmp, fact.canonicalKey);

    expect(await store.read(tmp, fact.canonicalKey)).toBeUndefined();
    const index = await store.readIndex(tmp);
    expect(index?.facts).toHaveLength(0);
  });

  it('read returns undefined for a missing fact', async () => {
    const store = new JsonKnowledgeFactsStore();
    expect(await store.read(tmp, 'does-not-exist')).toBeUndefined();
  });
});
