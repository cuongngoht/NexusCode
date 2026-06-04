import { describe, it, expect } from 'vitest';
import { parseDebugInput, hasNoEditFlag } from './DebugInputParser';

describe('parseDebugInput', () => {
  it('parses a JS stack trace with file and line', () => {
    const raw = [
      'TypeError: Cannot read properties of undefined (reading \'length\')',
      '    at runTask (src/webview/ChatController.ts:84:21)',
      '    at processTicksAndRejections (node:internal/process/task_queues:95:5)',
    ].join('\n');

    const sig = parseDebugInput(raw);
    expect(sig.kind).toBe('stack-trace');
    expect(sig.files).toHaveLength(1);
    expect(sig.files[0].path).toBe('src/webview/ChatController.ts');
    expect(sig.files[0].line).toBe(84);
    expect(sig.files[0].column).toBe(21);
    expect(sig.suspectedTools).toContain('node');
    expect(sig.confidence).toBeGreaterThan(0.5);
  });

  it('parses a TypeScript compiler error', () => {
    const raw = `src/core/types.ts(12,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`;

    const sig = parseDebugInput(raw);
    expect(sig.kind).toBe('type-error');
    expect(sig.files).toHaveLength(1);
    expect(sig.files[0].path).toBe('src/core/types.ts');
    expect(sig.files[0].line).toBe(12);
    expect(sig.files[0].column).toBe(5);
    expect(sig.suspectedTools).toContain('typescript');
  });

  it('parses a Vitest test failure', () => {
    const raw = [
      'vitest run src/webview-ui/messages.test.ts',
      '',
      'FAIL src/webview-ui/messages.test.ts',
      '  ● AppState reducer › should handle taskCompleted',
      '    expect(received).toBe(expected)',
      '    Expected: true',
      '    Received: false',
    ].join('\n');

    const sig = parseDebugInput(raw);
    expect(sig.kind).toBe('test-failure');
    expect(sig.suspectedTools).toContain('vitest');
  });

  it('detects failing command from prompt', () => {
    const raw = 'npm run compile fails with the error above';
    const sig = parseDebugInput(raw);
    expect(sig.command).toMatch(/npm run compile/);
  });

  it('returns unknown kind when input has no recognizable signals', () => {
    const sig = parseDebugInput('The button is not working');
    expect(sig.kind).toBe('unknown');
    expect(sig.files).toHaveLength(0);
    expect(sig.confidence).toBeLessThan(0.5);
  });

  it('deduplicates the same file reference', () => {
    const raw = [
      '    at foo (src/core/types.ts:10:5)',
      '    at bar (src/core/types.ts:10:5)',
    ].join('\n');

    const sig = parseDebugInput(raw);
    expect(sig.files).toHaveLength(1);
  });

  it('ignores node_modules paths in stack traces', () => {
    const raw = [
      '    at handler (node_modules/express/lib/router/index.js:284:7)',
      '    at runTask (src/app.ts:42:3)',
    ].join('\n');

    const sig = parseDebugInput(raw);
    expect(sig.files.every(f => !f.path.includes('node_modules'))).toBe(true);
  });

  it('detects multiple suspected tools', () => {
    const raw = 'vitest run — TS2345 error in src/foo.ts';
    const sig = parseDebugInput(raw);
    expect(sig.suspectedTools).toContain('vitest');
    expect(sig.suspectedTools).toContain('typescript');
  });
});

describe('hasNoEditFlag', () => {
  it('detects "no-edit" flag in prompt', () => {
    expect(hasNoEditFlag('Please analyze this no-edit')).toBe(true);
    expect(hasNoEditFlag('no edit mode please')).toBe(true);
    expect(hasNoEditFlag('noedit')).toBe(true);
  });

  it('returns false when flag is absent', () => {
    expect(hasNoEditFlag('Fix this bug in my code')).toBe(false);
  });
});
