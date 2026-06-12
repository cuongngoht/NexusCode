import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModelCache } from './ModelCache';
import type { ProviderModel } from '../core/types';

const MODELS: ProviderModel[] = [
  { id: 'model-a', label: 'Model A', source: 'seeded' },
  { id: 'model-b', label: 'Model B', source: 'seeded' },
];

describe('ModelCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for a cache miss', () => {
    const cache = new ModelCache(60_000);
    expect(cache.get('claude')).toBeUndefined();
  });

  it('returns models after set', () => {
    const cache = new ModelCache(60_000);
    cache.set('claude', MODELS);
    expect(cache.get('claude')).toEqual(MODELS);
  });

  it('expires entries after TTL', () => {
    const cache = new ModelCache(1_000);
    cache.set('claude', MODELS);
    vi.advanceTimersByTime(1_001);
    expect(cache.get('claude')).toBeUndefined();
  });

  it('does not expire entries before TTL', () => {
    const cache = new ModelCache(1_000);
    cache.set('claude', MODELS);
    vi.advanceTimersByTime(999);
    expect(cache.get('claude')).toEqual(MODELS);
  });

  it('invalidates a specific provider', () => {
    const cache = new ModelCache(60_000);
    cache.set('claude', MODELS);
    cache.set('codex', MODELS);
    cache.invalidate('claude');
    expect(cache.get('claude')).toBeUndefined();
    expect(cache.get('codex')).toEqual(MODELS);
  });

  it('invalidates all providers when called without argument', () => {
    const cache = new ModelCache(60_000);
    cache.set('claude', MODELS);
    cache.set('codex', MODELS);
    cache.invalidate();
    expect(cache.get('claude')).toBeUndefined();
    expect(cache.get('codex')).toBeUndefined();
  });

  it('overwrites an existing entry on set', () => {
    const cache = new ModelCache(60_000);
    cache.set('claude', MODELS);
    const newModels: ProviderModel[] = [{ id: 'new', label: 'New', source: 'detected' }];
    cache.set('claude', newModels);
    expect(cache.get('claude')).toEqual(newModels);
  });
});
