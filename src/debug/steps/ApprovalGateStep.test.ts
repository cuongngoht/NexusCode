import { describe, it, expect, vi } from 'vitest';
import { ApprovalGateStep } from './ApprovalGateStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';

function makeCtx(overrides: Partial<DebugChainContext>): DebugChainContext {
  const emit = vi.fn();
  return {
    workspaceRoot: '/tmp',
    originalPrompt: 'test',
    providerId: 'nexus',
    mode: 'debug',
    eventBus: { emit, on: vi.fn(), off: vi.fn() },
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
    ...overrides,
  } as DebugChainContext;
}

describe('ApprovalGateStep', () => {
  const step = new ApprovalGateStep();

  it('returns stop when noEdit is true', async () => {
    const ctx = makeCtx({ noEdit: true });
    const result = await step.run(ctx);
    expect(result.status).toBe('stop');
  });

  it('returns continue when autoApprove is true and sets approved', async () => {
    const ctx = makeCtx({ autoApprove: true });
    const result = await step.run(ctx);
    expect(result.status).toBe('continue');
    expect(ctx.approved).toBe(true);
  });

  it('returns await-approval by default (no autoApprove, no noEdit)', async () => {
    const ctx = makeCtx({ noEdit: false, autoApprove: false });
    const result = await step.run(ctx);
    expect(result.status).toBe('await-approval');
  });

  it('emits debug_approval_required when awaiting approval', async () => {
    const ctx = makeCtx({ noEdit: false, autoApprove: false });
    await step.run(ctx);
    const emittedKinds = (ctx.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: any[]) => c[0].kind
    );
    expect(emittedKinds).toContain('debug_approval_required');
  });

  it('does not emit debug_approval_required when noEdit is true', async () => {
    const ctx = makeCtx({ noEdit: true });
    await step.run(ctx);
    const emittedKinds = (ctx.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: any[]) => c[0].kind
    );
    expect(emittedKinds).not.toContain('debug_approval_required');
  });
});
