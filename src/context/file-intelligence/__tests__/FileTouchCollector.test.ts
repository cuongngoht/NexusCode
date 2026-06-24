import { describe, it, expect } from 'vitest';
import { FileTouchCollector } from '../FileTouchCollector';
import type { FileTouchEvent } from '../types';

function makeEvent(filePath: string): FileTouchEvent {
  return {
    filePath,
    workspaceRoot: '/workspace',
    mode: 'edit',
    reason: 'edit',
    source: 'edit',
    confidence: 0.7,
    timestamp: Date.now(),
  };
}

describe('FileTouchCollector', () => {
  it('collects events', () => {
    const collector = new FileTouchCollector();
    collector.collect(makeEvent('src/a.ts'));
    collector.collect(makeEvent('src/b.ts'));
    expect(collector.size).toBe(2);
  });

  it('drain returns all events and clears the queue', () => {
    const collector = new FileTouchCollector();
    collector.collect(makeEvent('src/a.ts'));
    collector.collect(makeEvent('src/b.ts'));

    const drained = collector.drain();
    expect(drained).toHaveLength(2);
    expect(drained[0].filePath).toBe('src/a.ts');
    expect(collector.size).toBe(0);
  });

  it('drain on empty collector returns empty array', () => {
    const collector = new FileTouchCollector();
    expect(collector.drain()).toEqual([]);
  });

  it('drain is idempotent on second call', () => {
    const collector = new FileTouchCollector();
    collector.collect(makeEvent('src/a.ts'));
    collector.drain();
    expect(collector.drain()).toEqual([]);
  });
});
