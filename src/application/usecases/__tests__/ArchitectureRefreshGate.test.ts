import { describe, it, expect } from 'vitest';
import { ArchitectureRefreshGate } from '../ArchitectureRefreshGate';

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

describe('ArchitectureRefreshGate', () => {
  it('runs a task when nothing is in flight', async () => {
    const gate = new ArchitectureRefreshGate();
    const result = await gate.run('/tmp/ws', async () => 42);
    expect(result).toBe(42);
  });

  it('coalesces a second call for the same workspaceRoot while one is in flight', async () => {
    const gate = new ArchitectureRefreshGate();
    let concurrentTaskCount = 0;
    let maxConcurrent = 0;
    const { promise: gateFirst, resolve: resolveFirst } = deferred<void>();

    const firstTask = async () => {
      concurrentTaskCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentTaskCount);
      await gateFirst;
      concurrentTaskCount--;
      return 'first';
    };

    const firstCall = gate.run('/tmp/ws', firstTask);
    const secondResult = await gate.run('/tmp/ws', async () => {
      concurrentTaskCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentTaskCount);
      concurrentTaskCount--;
      return 'second';
    });

    expect(secondResult).toEqual({ kind: 'coalesced' });
    resolveFirst();
    const firstResult = await firstCall;
    expect(firstResult).toBe('first');
    expect(maxConcurrent).toBe(1); // only one task ever in flight at a time
  });

  it('allows a new task to run once the previous one settles', async () => {
    const gate = new ArchitectureRefreshGate();
    await gate.run('/tmp/ws', async () => 'a');
    const second = await gate.run('/tmp/ws', async () => 'b');
    expect(second).toBe('b');
  });

  it('does not coalesce across different workspaceRoots', async () => {
    const gate = new ArchitectureRefreshGate();
    const { promise: gateA, resolve: resolveA } = deferred<void>();

    const callA = gate.run('/tmp/ws-a', async () => { await gateA; return 'a'; });
    const callB = await gate.run('/tmp/ws-b', async () => 'b');

    expect(callB).toBe('b');
    resolveA();
    expect(await callA).toBe('a');
  });
});
