import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KnowledgeFactsStep } from '../KnowledgeFactsStep';
import { JsonKnowledgeFactsStore } from '../../../context/knowledge-facts/JsonKnowledgeFactsStore';
import { buildCanonicalKey } from '../../../context/knowledge-facts/CanonicalKeyBuilder';
import type { PipelineContext } from '../../../core/pipeline/PipelineContext';
import type { KnowledgeFact } from '../../../context/knowledge-facts/types';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-kf-step-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    workspaceRoot: tmp,
    originalPrompt: 'Fix the login bug',
    mode: 'edit',
    model: undefined,
    providerId: 'nexus',
    enableEnhancement: true,
    enhancedPrompt: '',
    ...overrides,
  };
}

function makeFact(overrides: Partial<KnowledgeFact> = {}): KnowledgeFact {
  const canonicalKey = overrides.canonicalKey ?? buildCanonicalKey('invariant', 'LoginController', 'login is rate-limited');
  return {
    version: 1,
    schemaVersion: 'knowledge-fact-v1',
    id: 'id-1',
    canonicalKey,
    kind: 'invariant',
    subject: 'LoginController',
    statement: 'login is rate-limited',
    confidence: 0.9,
    status: 'verified',
    evidence: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspaceRoot: tmp,
    ...overrides,
  };
}

describe('KnowledgeFactsStep', () => {
  it('leaves knowledgeFactsContext unset when there are no facts', async () => {
    const step = new KnowledgeFactsStep();
    const ctx = makeCtx();
    await step.execute(ctx, () => {});
    expect(ctx.knowledgeFactsContext).toBeUndefined();
  });

  it('sets knowledgeFactsContext when a relevant fact exists', async () => {
    const store = new JsonKnowledgeFactsStore();
    await store.write(tmp, makeFact());

    const step = new KnowledgeFactsStep();
    const ctx = makeCtx({ originalPrompt: 'Why is LoginController rate-limited?' });
    await step.execute(ctx, () => {});

    expect(ctx.knowledgeFactsContext).toContain('LoginController');
  });

  it('never throws when the loader/facade fails', async () => {
    const brokenLoader = { loadAll: () => { throw new Error('boom'); } } as never;
    const step = new KnowledgeFactsStep(brokenLoader);
    const ctx = makeCtx();
    await expect(step.execute(ctx, () => {})).resolves.toBeUndefined();
    expect(ctx.knowledgeFactsContext).toBeUndefined();
  });

  it('compensate() resets knowledgeFactsContext', async () => {
    const step = new KnowledgeFactsStep();
    const ctx = makeCtx({ knowledgeFactsContext: 'stale' });
    await step.compensate(ctx, () => {});
    expect(ctx.knowledgeFactsContext).toBeUndefined();
  });
});
