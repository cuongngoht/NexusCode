import { describe, it, expect } from 'vitest';
import { ProviderRouteExpressionParser } from './ProviderRouteExpressionParser';

describe('ProviderRouteExpressionParser', () => {
  it('parses a single provider', () => {
    const plan = ProviderRouteExpressionParser.parse('claude');
    expect(plan.raw).toBe('claude');
    expect(plan.steps).toEqual([{ providerId: 'claude' }]);
  });

  it('parses auto', () => {
    const plan = ProviderRouteExpressionParser.parse('auto');
    expect(plan.steps).toEqual([{ providerId: 'auto' }]);
  });

  it('parses a fallback chain', () => {
    const plan = ProviderRouteExpressionParser.parse('grok+claude');
    expect(plan.steps).toEqual([
      { providerId: 'grok' },
      { providerId: 'claude' },
    ]);
  });

  it('parses a chain with model pinning', () => {
    const plan = ProviderRouteExpressionParser.parse('codex:gpt-5.2+claude:sonnet');
    expect(plan.steps).toEqual([
      { providerId: 'codex', model: 'gpt-5.2' },
      { providerId: 'claude', model: 'sonnet' },
    ]);
  });

  it('parses single provider with model', () => {
    const plan = ProviderRouteExpressionParser.parse('claude:opus');
    expect(plan.steps).toEqual([{ providerId: 'claude', model: 'opus' }]);
  });

  it('omits model when colon is not present', () => {
    const plan = ProviderRouteExpressionParser.parse('codex');
    expect(plan.steps[0]).not.toHaveProperty('model');
  });

  it('trims whitespace around provider names', () => {
    const plan = ProviderRouteExpressionParser.parse(' claude ');
    expect(plan.steps).toEqual([{ providerId: 'claude' }]);
  });

  it('throws for empty expression', () => {
    expect(() => ProviderRouteExpressionParser.parse('')).toThrow('empty');
  });

  it('throws for unknown provider', () => {
    expect(() => ProviderRouteExpressionParser.parse('unknown-provider')).toThrow();
  });

  it('throws for empty token in chain', () => {
    expect(() => ProviderRouteExpressionParser.parse('claude++codex')).toThrow('Empty token');
  });

  it('preserves the raw expression', () => {
    const raw = 'claude:opus+codex';
    const plan = ProviderRouteExpressionParser.parse(raw);
    expect(plan.raw).toBe(raw);
  });

  it('handles three-provider chain', () => {
    const plan = ProviderRouteExpressionParser.parse('grok+claude+codex');
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map(s => s.providerId)).toEqual(['grok', 'claude', 'codex']);
  });
});
