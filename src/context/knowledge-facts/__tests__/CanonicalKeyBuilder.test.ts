import { describe, it, expect } from 'vitest';
import { buildCanonicalKey, normalizeForKey } from '../CanonicalKeyBuilder';

describe('normalizeForKey', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeForKey('  IEventBus emit   is   synchronous  ')).toBe('ieventbus emit is synchronous');
  });

  it('strips common punctuation', () => {
    expect(normalizeForKey('Fire-and-forget: never throws!')).toBe('fire-and-forget never throws');
  });
});

describe('buildCanonicalKey', () => {
  it('produces the same key for statements differing only in case/whitespace/punctuation', () => {
    const a = buildCanonicalKey('invariant', 'IEventBus', 'emit is synchronous and fire-and-forget.');
    const b = buildCanonicalKey('invariant', '  ieventbus  ', 'Emit is synchronous and fire-and-forget');
    expect(a).toBe(b);
  });

  it('produces a different key for a different kind', () => {
    const a = buildCanonicalKey('invariant', 'IEventBus', 'emit is synchronous');
    const b = buildCanonicalKey('contract', 'IEventBus', 'emit is synchronous');
    expect(a).not.toBe(b);
  });

  it('produces a different key for a different subject', () => {
    const a = buildCanonicalKey('invariant', 'IEventBus', 'emit is synchronous');
    const b = buildCanonicalKey('invariant', 'RunAgentUseCase', 'emit is synchronous');
    expect(a).not.toBe(b);
  });

  it('produces a different key for a different statement', () => {
    const a = buildCanonicalKey('invariant', 'IEventBus', 'emit is synchronous');
    const b = buildCanonicalKey('invariant', 'IEventBus', 'emit is asynchronous');
    expect(a).not.toBe(b);
  });

  it('returns a 16-character hex string', () => {
    const key = buildCanonicalKey('module', 'src/core/Foo.ts', 'exports a Foo class');
    expect(key).toMatch(/^[a-f0-9]{16}$/);
  });
});
