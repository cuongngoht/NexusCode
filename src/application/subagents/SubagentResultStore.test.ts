import { describe, expect, it } from 'vitest';
import { SubagentResultStore } from './SubagentResultStore';
import type { SubagentRunTrace, SubagentResult } from './SubagentResultStore';

function makeResult(role = 'search'): SubagentResult {
  return { role: role as SubagentResult['role'], agentId: 'codex', compactOutput: 'output', durationMs: 100 };
}

function makeTrace(runId: string): SubagentRunTrace {
  return { runId, mode: 'debug', startedAt: Date.now(), results: [] };
}

describe('SubagentResultStore', () => {
  it('saves and retrieves a run', () => {
    const store = new SubagentResultStore();
    const trace = makeTrace('run-1');
    store.saveRun('run-1', trace);
    expect(store.getRun('run-1')).toBe(trace);
  });

  it('returns undefined for unknown run', () => {
    const store = new SubagentResultStore();
    expect(store.getRun('nonexistent')).toBeUndefined();
  });

  it('appends result to existing run', () => {
    const store = new SubagentResultStore();
    store.saveRun('run-1', makeTrace('run-1'));
    store.appendResult('run-1', makeResult('search'));
    expect(store.getRun('run-1')!.results).toHaveLength(1);
  });

  it('clears a run', () => {
    const store = new SubagentResultStore();
    store.saveRun('run-1', makeTrace('run-1'));
    store.clearRun('run-1');
    expect(store.getRun('run-1')).toBeUndefined();
  });

  it('listRecent returns newest entries', () => {
    const store = new SubagentResultStore();
    store.saveRun('run-1', makeTrace('run-1'));
    store.saveRun('run-2', makeTrace('run-2'));
    const recent = store.listRecent(10);
    expect(recent.map(r => r.runId)).toContain('run-1');
    expect(recent.map(r => r.runId)).toContain('run-2');
  });

  it('listRecent respects limit', () => {
    const store = new SubagentResultStore();
    for (let i = 0; i < 5; i++) store.saveRun(`run-${i}`, makeTrace(`run-${i}`));
    expect(store.listRecent(3)).toHaveLength(3);
  });
});
