import { describe, it, expect, vi } from 'vitest';
import { DebugChain } from './DebugChain';
import type { DebugStep, DebugStepResult } from './DebugStep';
import type { DebugChainContext } from './DebugChainContext';

function makeMinimalCtx(): DebugChainContext {
  return {
    workspaceRoot: '/tmp',
    originalPrompt: 'test',
    providerId: 'nexus',
    mode: 'debug',
    eventBus: { emit: () => {}, on: () => {}, off: () => {} } as any,
    state: 'idle',
    projectExcludeFromIndex: [],
    selectedFiles: [],
    bm25Results: [],
    strategyResults: [],
    toolResults: [],
    evidence: [],
    suspectedTools: [],
    packageManager: null,
    packageScripts: {},
    gitChangedFiles: [],
    noEdit: false,
    addRegressionTest: true,
    rerunAfterFix: true,
    autoApprove: false,
    approved: false,
    maxBm25Results: 12,
    maxInvestigationRounds: 4,
    maxFileBytes: 200_000,
  } as DebugChainContext;
}

function makeStep(name: string, result: DebugStepResult): DebugStep {
  return {
    name,
    run: vi.fn().mockResolvedValue(result),
  };
}

describe('DebugChain', () => {
  it('runs all steps when all return continue', async () => {
    const step1 = makeStep('step1', { status: 'continue' });
    const step2 = makeStep('step2', { status: 'continue' });
    const step3 = makeStep('step3', { status: 'continue' });
    const chain = new DebugChain([step1, step2, step3]);
    const ctx = makeMinimalCtx();
    await chain.run(ctx);
    expect(step1.run).toHaveBeenCalledOnce();
    expect(step2.run).toHaveBeenCalledOnce();
    expect(step3.run).toHaveBeenCalledOnce();
  });

  it('stops at await-approval and does not run subsequent steps', async () => {
    const step1 = makeStep('step1', { status: 'continue' });
    const step2 = makeStep('step2', { status: 'await-approval' });
    const step3 = makeStep('step3', { status: 'continue' });
    const chain = new DebugChain([step1, step2, step3]);
    const ctx = makeMinimalCtx();
    await chain.run(ctx);
    expect(step1.run).toHaveBeenCalledOnce();
    expect(step2.run).toHaveBeenCalledOnce();
    expect(step3.run).not.toHaveBeenCalled();
  });

  it('stops at stop status and does not run subsequent steps', async () => {
    const step1 = makeStep('step1', { status: 'stop' });
    const step2 = makeStep('step2', { status: 'continue' });
    const chain = new DebugChain([step1, step2]);
    const ctx = makeMinimalCtx();
    await chain.run(ctx);
    expect(step1.run).toHaveBeenCalledOnce();
    expect(step2.run).not.toHaveBeenCalled();
  });

  it('throws when a step returns error status', async () => {
    const step1 = makeStep('step1', { status: 'error', message: 'Something broke' });
    const chain = new DebugChain([step1]);
    const ctx = makeMinimalCtx();
    await expect(chain.run(ctx)).rejects.toThrow('Something broke');
  });

  it('ApplyFixStep is not executed when ApprovalGateStep returns await-approval', async () => {
    const approvalGate = makeStep('approval-gate', { status: 'await-approval' });
    const applyFix = makeStep('apply-fix', { status: 'continue' });
    const chain = new DebugChain([approvalGate, applyFix]);
    const ctx = makeMinimalCtx();
    await chain.run(ctx);
    expect(approvalGate.run).toHaveBeenCalledOnce();
    expect(applyFix.run).not.toHaveBeenCalled();
  });
});
