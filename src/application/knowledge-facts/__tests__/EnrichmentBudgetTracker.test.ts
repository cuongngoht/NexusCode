import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnrichmentBudgetTracker } from '../EnrichmentBudgetTracker';

function makeFakeMemento(initial: Record<string, unknown> = {}) {
  const store = { ...initial };
  return {
    get: vi.fn((key: string) => store[key]),
    update: vi.fn(async (key: string, value: unknown) => { store[key] = value; }),
  };
}

describe('EnrichmentBudgetTracker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows runs up to the daily max, then denies the next one', async () => {
    const memento = makeFakeMemento();
    const tracker = new EnrichmentBudgetTracker(memento as any);

    for (let i = 0; i < 5; i++) {
      expect(tracker.canRunNow(5)).toBe(true);
      await tracker.recordRun();
    }

    expect(tracker.canRunNow(5)).toBe(false);
  });

  it('resets the counter on a new calendar day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));

    const memento = makeFakeMemento();
    const tracker = new EnrichmentBudgetTracker(memento as any);
    for (let i = 0; i < 5; i++) await tracker.recordRun();
    expect(tracker.canRunNow(5)).toBe(false);

    vi.setSystemTime(new Date('2026-01-02T00:00:01Z'));
    expect(tracker.canRunNow(5)).toBe(true);
  });

  it('treats maxPerDay:0 as always denied once state exists for today', async () => {
    const memento = makeFakeMemento();
    const tracker = new EnrichmentBudgetTracker(memento as any);
    expect(tracker.canRunNow(0)).toBe(true); // no state yet today — first check is always true
    await tracker.recordRun();
    expect(tracker.canRunNow(0)).toBe(false);
  });
});
