import { describe, it, expect } from 'vitest';
import { buildDebugQueries } from './DebugQueryBuilder';
import { parseDebugInput } from '../DebugInputParser';

describe('buildDebugQueries', () => {
  it('includes error code in queries for TypeScript error', () => {
    const raw = `src/foo.ts(10,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`;
    const signal = parseDebugInput(raw);
    const queries = buildDebugQueries(signal, raw);
    expect(queries.some(q => q.includes('TS2345') || q.includes('ts2345'))).toBe(true);
  });

  it('includes file path for TypeScript error file', () => {
    const raw = `src/foo.ts(10,5): error TS2345: Argument of type 'string' is not assignable.`;
    const signal = parseDebugInput(raw);
    const queries = buildDebugQueries(signal, raw);
    expect(queries.some(q => q.includes('src/foo.ts') || q.includes('foo'))).toBe(true);
  });

  it('includes file basename for stack trace', () => {
    const raw = [
      'TypeError: Cannot read properties of undefined',
      '    at runTask (src/webview/handlers/RunTaskHandler.ts:123:10)',
    ].join('\n');
    const signal = parseDebugInput(raw);
    const queries = buildDebugQueries(signal, raw);
    expect(queries.some(q => q.includes('RunTaskHandler') || q.includes('runtaskhandler'))).toBe(true);
  });

  it('includes suspected tool names', () => {
    const raw = 'vitest run — TS2345 error in src/foo.ts';
    const signal = parseDebugInput(raw);
    const queries = buildDebugQueries(signal, raw);
    expect(queries.some(q => q.toLowerCase().includes('vitest'))).toBe(true);
  });

  it('deduplicates queries', () => {
    const raw = 'npm run typecheck TS2345 TS2345';
    const signal = parseDebugInput(raw);
    const queries = buildDebugQueries(signal, raw);
    const ts2345Count = queries.filter(q => q.trim().toLowerCase() === 'ts2345').length;
    expect(ts2345Count).toBeLessThanOrEqual(1);
  });

  it('returns no empty queries', () => {
    const raw = 'The button is broken';
    const signal = parseDebugInput(raw);
    const queries = buildDebugQueries(signal, raw);
    for (const q of queries) {
      expect(q.trim().length).toBeGreaterThan(0);
    }
  });
});
