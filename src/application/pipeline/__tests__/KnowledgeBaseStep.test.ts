import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KnowledgeBaseStep } from '../KnowledgeBaseStep';
import { KnowledgeBaseWriter } from '../../../context/knowledge-base/KnowledgeBaseWriter';
import type { PipelineContext } from '../../../core/pipeline/PipelineContext';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-kb-step-test-'));
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

describe('KnowledgeBaseStep', () => {
  it('leaves knowledgeBaseContext unset when there are no prior entries', async () => {
    const step = new KnowledgeBaseStep();
    const ctx = makeCtx();
    await step.execute(ctx, () => {});
    expect(ctx.knowledgeBaseContext).toBeUndefined();
  });

  it('sets knowledgeBaseContext when a relevant prior entry exists', async () => {
    const writer = new KnowledgeBaseWriter();
    await writer.write(tmp, {
      mode: 'edit',
      providerId: 'nexus',
      originalPrompt: 'Fix the login authentication bug',
      status: 'completed',
      changedFiles: [{ path: 'src/auth/login.ts', status: 'M' }],
      source: 'task-pipeline',
    });

    const step = new KnowledgeBaseStep();
    const ctx = makeCtx({ originalPrompt: 'Fix the login authentication bug again' });
    await step.execute(ctx, () => {});

    expect(ctx.knowledgeBaseContext).toContain('Project Knowledge Base');
  });

  it('never throws when the loader/facade fails', async () => {
    const brokenLoader = { loadRecentEntries: () => { throw new Error('boom'); } } as never;
    const step = new KnowledgeBaseStep(brokenLoader);
    const ctx = makeCtx();
    await expect(step.execute(ctx, () => {})).resolves.toBeUndefined();
    expect(ctx.knowledgeBaseContext).toBeUndefined();
  });

  it('compensate() resets knowledgeBaseContext', async () => {
    const step = new KnowledgeBaseStep();
    const ctx = makeCtx({ knowledgeBaseContext: 'stale' });
    await step.compensate(ctx, () => {});
    expect(ctx.knowledgeBaseContext).toBeUndefined();
  });
});
