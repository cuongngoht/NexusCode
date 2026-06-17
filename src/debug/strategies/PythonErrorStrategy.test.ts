import { describe, it, expect } from 'vitest';
import { PythonErrorStrategy } from './PythonErrorStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';

function makeCtx(overrides: Partial<DebugChainContext>): DebugChainContext {
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

describe('PythonErrorStrategy', () => {
  const strategy = new PythonErrorStrategy();

  it('canHandle returns true for Python Traceback', () => {
    const ctx = makeCtx({
      signal: {
        raw: `Traceback (most recent call last):\n  File "app/models.py", line 42, in get_user\nModuleNotFoundError: No module named 'myapp'`,
        kind: 'stack-trace',
        files: [],
        suspectedTools: [],
        confidence: 0.6,
      },
    });
    expect(strategy.canHandle(ctx)).toBe(true);
  });

  it('canHandle returns true for ModuleNotFoundError', () => {
    const ctx = makeCtx({
      signal: {
        raw: 'ModuleNotFoundError: No module named requests',
        kind: 'unknown',
        files: [],
        suspectedTools: [],
        confidence: 0.3,
      },
    });
    expect(strategy.canHandle(ctx)).toBe(true);
  });

  it('canHandle returns true when pytest is in suspectedTools', () => {
    const ctx = makeCtx({ suspectedTools: ['pytest'] });
    expect(strategy.canHandle(ctx)).toBe(true);
  });

  it('canHandle returns true when detectedLanguage is python', () => {
    const ctx = makeCtx({ detectedLanguage: 'python' });
    expect(strategy.canHandle(ctx)).toBe(true);
  });

  it('canHandle returns false for unrelated TypeScript error', () => {
    const ctx = makeCtx({
      signal: {
        raw: `src/types.ts(10,5): error TS2345: Argument of type 'string' is not assignable.`,
        kind: 'type-error',
        files: [{ path: 'src/types.ts', line: 10, column: 5 }],
        suspectedTools: ['typescript'],
        confidence: 0.8,
      },
      suspectedTools: ['typescript'],
    });
    expect(strategy.canHandle(ctx)).toBe(false);
  });

  it('search extracts .py files from traceback output', async () => {
    const raw = `Traceback (most recent call last):\n  File "app/models.py", line 42, in get_user\n  File "app/utils.py", line 10, in helper\nAttributeError: 'NoneType' object has no attribute 'email'`;
    const ctx = makeCtx({
      signal: { raw, kind: 'stack-trace', files: [], suspectedTools: [], confidence: 0.6 },
    });
    const results = await strategy.search(ctx);
    const paths = results.map(r => r.path);
    expect(paths).toContain('app/models.py');
    expect(paths).toContain('app/utils.py');
  });

  it('search gives high score to traceback files', async () => {
    const raw = `Traceback (most recent call last):\n  File "src/main.py", line 5\nModuleNotFoundError: No module named 'foo'`;
    const ctx = makeCtx({
      signal: { raw, kind: 'stack-trace', files: [], suspectedTools: [], confidence: 0.6 },
    });
    const results = await strategy.search(ctx);
    const mainPy = results.find(r => r.path === 'src/main.py');
    expect(mainPy).toBeDefined();
    expect(mainPy!.score).toBeGreaterThanOrEqual(180);
  });

  it('search does not include site-packages paths', async () => {
    const raw = `Traceback (most recent call last):\n  File "/usr/lib/python3/site-packages/requests/api.py", line 10\n  File "app/client.py", line 5\nConnectionError: timeout`;
    const ctx = makeCtx({
      signal: { raw, kind: 'stack-trace', files: [], suspectedTools: [], confidence: 0.5 },
    });
    const results = await strategy.search(ctx);
    const paths = results.map(r => r.path);
    expect(paths).not.toContain('/usr/lib/python3/site-packages/requests/api.py');
    expect(paths).toContain('app/client.py');
  });
});
