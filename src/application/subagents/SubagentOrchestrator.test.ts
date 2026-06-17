import { describe, expect, it, vi } from 'vitest';
import { AgentCapabilities, AgentCommand } from '../../core/agent';
import type { IAgent } from '../../core/agent';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import { SubagentOrchestrator } from './SubagentOrchestrator';
import type { SubagentDefinition } from './SubagentDefinition';
import type { SubagentPlanner } from './SubagentPlanner';
import type { SubagentRouter } from './SubagentRouter';
import type { SubagentExecutor } from './SubagentExecutor';

const reviewerDef: SubagentDefinition = {
  role: 'reviewer',
  displayName: 'Reviewer',
  promptFile: 'subagents/reviewer.md',
  preferredAgentIds: ['codex'],
  applicableModes: ['review'],
};

function makeAgent(): IAgent {
  return {
    id: 'codex',
    displayName: 'Codex',
    capabilities: AgentCapabilities.none(),
    seededModels: [],
    isAvailable: vi.fn(async () => true),
    buildCommand: vi.fn(() => new AgentCommand('codex', [])),
    parseOutput: vi.fn(raw => ({ content: raw, format: 'text' })),
  };
}

function makeOrchestrator(opts?: {
  plan?: SubagentDefinition[];
  agent?: IAgent | null;
}) {
  const planner = {
    plan: vi.fn(() => opts?.plan ?? [reviewerDef]),
  };
  const router = {
    resolve: vi.fn(async () => opts?.agent === null ? undefined : opts?.agent ?? makeAgent()),
  };
  const executor = {
    execute: vi.fn(async () => ({
      role: 'reviewer',
      agentId: 'codex',
      compactOutput: 'ok',
      durationMs: 1,
    })),
    stop: vi.fn(async () => undefined),
  };

  return {
    orchestrator: new SubagentOrchestrator(
      planner as unknown as SubagentPlanner,
      router as unknown as SubagentRouter,
      executor as unknown as SubagentExecutor,
    ),
    planner,
    router,
    executor,
  };
}

describe('SubagentOrchestrator', () => {
  it('uses the same plan config shape for countPlanned and run', async () => {
    const { orchestrator, planner } = makeOrchestrator({ plan: [] });
    const cfg = {
      mode: 'review' as const,
      subagentMode: 'manual' as const,
      selectedRoles: ['security'],
      maxRuns: 3,
      maxParallel: 2,
      hardCap: 4,
      includeSecurity: true,
      includeDocs: false,
      enabledSteps: { reviewer: false, tester: true, security: true, architect: true },
    };
    const ctx: PipelineContext = {
      workspaceRoot: '/tmp',
      originalPrompt: 'review',
      mode: 'review',
      model: undefined,
      providerId: 'codex',
      enableEnhancement: true,
      enhancedPrompt: 'review',
    };

    orchestrator.countPlanned(cfg);
    await orchestrator.run(ctx, vi.fn(), { ...cfg, maxCharsPerResult: 1000 }, 0, 1);

    expect(planner.plan).toHaveBeenNthCalledWith(1, cfg);
    expect(planner.plan).toHaveBeenNthCalledWith(2, { ...cfg, maxCharsPerResult: 1000 });
  });

  it('sets ctx.codeReviewRawOutput when reviewer subagent returns rawOutput', async () => {
    const { orchestrator } = makeOrchestrator({
      plan: [reviewerDef],
      agent: makeAgent(),
    });
    (orchestrator as unknown as { executor: { execute: ReturnType<typeof vi.fn> } }).executor.execute.mockResolvedValue({
      role: 'reviewer',
      agentId: 'codex',
      compactOutput: '{"summary":"ok","verdict":"approve","findings":[]}',
      rawOutput: '{"summary":"ok","verdict":"approve","findings":[]}',
      durationMs: 1,
    });

    const ctx: PipelineContext = {
      workspaceRoot: '/tmp',
      originalPrompt: 'review',
      mode: 'review',
      model: undefined,
      providerId: 'codex',
      enableEnhancement: true,
      enhancedPrompt: 'review',
    };

    const cfg = {
      mode: 'review' as const,
      subagentMode: 'auto' as const,
      selectedRoles: [],
      maxRuns: 1,
      maxParallel: 1,
      hardCap: 2,
      includeSecurity: false,
      includeDocs: false,
      maxCharsPerResult: 1000,
    };

    await orchestrator.run(ctx, vi.fn(), cfg, 0, 1);

    expect(ctx.codeReviewRawOutput).toBe('{"summary":"ok","verdict":"approve","findings":[]}');
  });
});
