import { describe, it, expect } from 'vitest';
import { TypeScriptErrorStrategy } from './TypeScriptErrorStrategy';
import { parseDebugInput } from '../DebugInputParser';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';

function makeMinimalCtx(overrides: Partial<DebugChainContext>): DebugChainContext {
  return {
    workspaceRoot: '/tmp/test-workspace',
    originalPrompt: '',
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
    ...overrides,
  } as DebugChainContext;
}

describe('TypeScriptErrorStrategy', () => {
  const strategy = new TypeScriptErrorStrategy();

  it('canHandle returns true for type-error kind', () => {
    const raw = `src/core/types.ts(12,5): error TS2345: Argument of type 'string' is not assignable.`;
    const signal = parseDebugInput(raw);
    const ctx = makeMinimalCtx({ signal, suspectedTools: signal.suspectedTools });
    expect(strategy.canHandle(ctx)).toBe(true);
  });

  it('canHandle returns true when typescript is in suspectedTools', () => {
    const ctx = makeMinimalCtx({ suspectedTools: ['typescript'] });
    expect(strategy.canHandle(ctx)).toBe(true);
  });

  it('canHandle returns false for unrelated error', () => {
    const raw = 'The button is broken';
    const signal = parseDebugInput(raw);
    const ctx = makeMinimalCtx({ signal, suspectedTools: signal.suspectedTools });
    expect(strategy.canHandle(ctx)).toBe(false);
  });

  it('includes the TypeScript error file in results', async () => {
    const raw = `src/core/types.ts(12,5): error TS2345: Argument of type 'string' is not assignable.`;
    const signal = parseDebugInput(raw);
    const ctx = makeMinimalCtx({ signal, suspectedTools: signal.suspectedTools });
    const results = await strategy.search(ctx);
    const paths = results.map(r => r.path);
    expect(paths).toContain('src/core/types.ts');
  });
});
