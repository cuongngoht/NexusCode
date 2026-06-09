import { describe, expect, it } from 'vitest';
import { normalizeProviderId, normalizeAgentId } from './providerMigration';

describe('normalizeProviderId', () => {
  it('maps legacy gemini to antigravity', () => {
    expect(normalizeProviderId('gemini')).toBe('antigravity');
  });

  it('passes through valid provider ids unchanged', () => {
    expect(normalizeProviderId('antigravity')).toBe('antigravity');
    expect(normalizeProviderId('claude')).toBe('claude');
    expect(normalizeProviderId('codex')).toBe('codex');
    expect(normalizeProviderId('nexus')).toBe('nexus');
    expect(normalizeProviderId('auto')).toBe('auto');
  });

  it('falls back to auto for unknown ids', () => {
    expect(normalizeProviderId('unknown')).toBe('auto');
    expect(normalizeProviderId('')).toBe('auto');
  });
});

describe('normalizeAgentId', () => {
  it('maps legacy gemini to antigravity', () => {
    expect(normalizeAgentId('gemini')).toBe('antigravity');
  });

  it('passes through valid agent ids unchanged', () => {
    expect(normalizeAgentId('antigravity')).toBe('antigravity');
    expect(normalizeAgentId('claude')).toBe('claude');
    expect(normalizeAgentId('codex')).toBe('codex');
  });

  it('falls back to auto for unknown ids', () => {
    expect(normalizeAgentId('unknown')).toBe('auto');
  });
});
