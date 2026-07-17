import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EnrichAndRecordFactsUseCase } from '../EnrichAndRecordFactsUseCase';
import { JsonKnowledgeFactsStore } from '../../../context/knowledge-facts';
import { AgentResult } from '../../../core/agent/AgentResult';
import type { ProjectMapAiRunner } from '../../../infrastructure/ai/ProjectMapAiRunner';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-enrich-facts-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeFakeRunner(result: AgentResult) {
  return { run: vi.fn().mockResolvedValue(result) } as unknown as ProjectMapAiRunner;
}

describe('EnrichAndRecordFactsUseCase', () => {
  it('writes candidate facts with AI-observed evidence on a successful run', async () => {
    const stdout = JSON.stringify({
      facts: [{ kind: 'lesson', subject: 'Foo', statement: 'bar', confidence: 0.8, evidenceExcerpt: 'excerpt' }],
    });
    const runner = makeFakeRunner(new AgentResult(0, stdout, '', 10));
    const store = new JsonKnowledgeFactsStore();
    const useCase = new EnrichAndRecordFactsUseCase(runner, undefined as any, undefined as any, undefined as any, store);

    const output = await useCase.execute({
      workspaceRoot: tmp, provider: 'claude', triggerReason: 'debug-root-cause', contextForPrompt: 'ctx', taskId: 'task-1',
    });

    expect(output.factsWritten).toBe(1);
    const all = await store.listAll(tmp);
    expect(all).toHaveLength(1);

    const fact = await store.read(tmp, all[0].canonicalKey);
    expect(fact?.status).toBe('candidate');
    expect(fact?.evidence[0].observedBy).toBe('ai');
    expect(fact?.evidence[0].taskId).toBe('task-1');
  });

  it('writes nothing when the AI run fails', async () => {
    const runner = makeFakeRunner(new AgentResult(1, '', 'boom', 10));
    const store = new JsonKnowledgeFactsStore();
    const useCase = new EnrichAndRecordFactsUseCase(runner, undefined as any, undefined as any, undefined as any, store);

    const output = await useCase.execute({
      workspaceRoot: tmp, provider: 'claude', triggerReason: 'debug-root-cause', contextForPrompt: 'ctx', taskId: 'task-1',
    });

    expect(output.factsWritten).toBe(0);
    expect(await store.listAll(tmp)).toHaveLength(0);
  });

  it('writes nothing when the AI output has no extractable JSON', async () => {
    const runner = makeFakeRunner(new AgentResult(0, 'not json at all', '', 10));
    const store = new JsonKnowledgeFactsStore();
    const useCase = new EnrichAndRecordFactsUseCase(runner, undefined as any, undefined as any, undefined as any, store);

    const output = await useCase.execute({
      workspaceRoot: tmp, provider: 'claude', triggerReason: 'debug-root-cause', contextForPrompt: 'ctx', taskId: 'task-1',
    });

    expect(output.factsWritten).toBe(0);
  });

  it('writes nothing when validation rejects the outer shape', async () => {
    const runner = makeFakeRunner(new AgentResult(0, JSON.stringify({ notFacts: [] }), '', 10));
    const store = new JsonKnowledgeFactsStore();
    const useCase = new EnrichAndRecordFactsUseCase(runner, undefined as any, undefined as any, undefined as any, store);

    const output = await useCase.execute({
      workspaceRoot: tmp, provider: 'claude', triggerReason: 'debug-root-cause', contextForPrompt: 'ctx', taskId: 'task-1',
    });

    expect(output.factsWritten).toBe(0);
  });
});
