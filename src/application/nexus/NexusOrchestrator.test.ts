import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NexusOrchestrator } from './NexusOrchestrator';
import { AgentRegistry } from '../AgentRegistry';
import { AgentResult } from '../../core/agent/AgentResult';
import { AgentCapabilities } from '../../core/agent/AgentCapabilities';
import type { IAgent } from '../../core/agent/IAgent';
import type { IEventBus, NexusEvent } from '../../core/events/IEventBus';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { RunAgentUseCase } from '../usecases/RunAgentUseCase';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

function makeAgent(id: string, capabilities = new AgentCapabilities(true, true, true, true)): IAgent {
  return {
    id: id as IAgent['id'],
    displayName: id,
    capabilities,
    seededModels: [],
    isAvailable: vi.fn().mockResolvedValue(true),
    buildCommand: vi.fn(),
    parseOutput: vi.fn(),
  };
}

function makeEventBus(): IEventBus & { emitted: NexusEvent[] } {
  const emitted: NexusEvent[] = [];
  return {
    emitted,
    emit: vi.fn((e: NexusEvent) => emitted.push(e)),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function makeRunUseCase(stdout = 'step 1: do this'): Partial<RunAgentUseCase> {
  return {
    executeWithAgent: vi.fn().mockResolvedValue(new AgentResult(0, stdout, '', 100)),
    hasActiveTask: vi.fn().mockReturnValue(false),
    stop: vi.fn(),
  };
}

function makeCtx(workspaceRoot: string, override: Partial<PipelineContext> = {}): PipelineContext {
  return {
    workspaceRoot,
    originalPrompt: 'build feature X',
    enhancedPrompt: 'build feature X',
    mode: 'edit',
    model: undefined,
    providerId: 'nexus',
    enableEnhancement: false,
    ...override,
  };
}

describe('NexusOrchestrator — approval gate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
  });

  it('emits plan_ready_for_approval after plan stage in coding mode', async () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent('claude'));
    const runUseCase = makeRunUseCase('Here is the plan');
    const eventBus = makeEventBus();
    const orchestrator = new NexusOrchestrator(registry, runUseCase as RunAgentUseCase, eventBus);

    await orchestrator.run(makeCtx(tmpDir), 'plan');

    const approvalEvent = eventBus.emitted.find(e => e.kind === 'plan_ready_for_approval');
    expect(approvalEvent).toBeDefined();
    expect(approvalEvent?.kind).toBe('plan_ready_for_approval');
    if (approvalEvent?.kind === 'plan_ready_for_approval') {
      expect(approvalEvent.plan).toBe('Here is the plan');
      expect(approvalEvent.mode).toBe('edit');
    }
  });

  it('does not emit plan_ready_for_approval for non-coding modes', async () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent('claude'));
    const runUseCase = makeRunUseCase('a plan');
    const eventBus = makeEventBus();
    const orchestrator = new NexusOrchestrator(registry, runUseCase as RunAgentUseCase, eventBus);

    await orchestrator.run(makeCtx(tmpDir, { mode: 'ask' }), 'plan');

    const approvalEvent = eventBus.emitted.find(e => e.kind === 'plan_ready_for_approval');
    expect(approvalEvent).toBeUndefined();
  });

  it('does not run code stage without autoApprove', async () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent('claude'));
    const runUseCase = makeRunUseCase('Here is the plan');
    const eventBus = makeEventBus();
    const orchestrator = new NexusOrchestrator(registry, runUseCase as RunAgentUseCase, eventBus);

    await orchestrator.run(makeCtx(tmpDir), 'auto');

    const codeStepStarted = eventBus.emitted.find(
      e => e.kind === 'step_started' && (e as { stepLabel?: string }).stepLabel === 'code',
    );
    expect(codeStepStarted).toBeUndefined();
  });

  it('runs code stage when autoApprove is true', async () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent('claude'));
    registry.register(makeAgent('codex', new AgentCapabilities(true, true, false, true)));
    const runUseCase = makeRunUseCase('Here is the plan');
    const eventBus = makeEventBus();
    const orchestrator = new NexusOrchestrator(registry, runUseCase as RunAgentUseCase, eventBus);

    await orchestrator.run(makeCtx(tmpDir, { autoApprove: true }), 'auto');

    const codeStepStarted = eventBus.emitted.find(
      e => e.kind === 'step_started' && (e as { stepLabel?: string }).stepLabel === 'code',
    );
    expect(codeStepStarted).toBeDefined();
    const codeStepCompleted = eventBus.emitted.find(
      e => e.kind === 'step_completed' && (e as { stepLabel?: string }).stepLabel === 'code',
    );
    expect(codeStepCompleted).toBeDefined();
  });

  it('totalSteps includes code stage when autoApprove is true', async () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent('claude'));
    registry.register(makeAgent('codex', new AgentCapabilities(true, true, false, true)));
    const runUseCase = makeRunUseCase('plan content');
    const eventBus = makeEventBus();
    const orchestrator = new NexusOrchestrator(registry, runUseCase as RunAgentUseCase, eventBus);

    await orchestrator.run(makeCtx(tmpDir, { autoApprove: true }), 'auto');

    // MODE_FLOW['edit'] = ['search', 'plan'] -> 2 steps + 1 code = 3 total
    const firstStep = eventBus.emitted.find(
      e => e.kind === 'step_started' && (e as { stepIndex?: number }).stepIndex === 0,
    );
    expect(firstStep?.kind === 'step_started' && (firstStep as { totalSteps?: number }).totalSteps).toBe(3);
  });
});
