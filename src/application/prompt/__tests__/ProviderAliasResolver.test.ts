import { describe, it, expect } from 'vitest';
import {
  normalizeProviderAlias,
  normalizeProviderRoute,
  displayProviderRoute,
} from '../ProviderAliasResolver';

describe('normalizeProviderAlias', () => {
  it('maps agy to antigravity', () => {
    expect(normalizeProviderAlias('agy')).toBe('antigravity');
  });

  it('maps gemini to antigravity', () => {
    expect(normalizeProviderAlias('gemini')).toBe('antigravity');
  });

  it('maps antigravity to antigravity', () => {
    expect(normalizeProviderAlias('antigravity')).toBe('antigravity');
  });

  it('leaves grok unchanged', () => {
    expect(normalizeProviderAlias('grok')).toBe('grok');
  });
});

describe('normalizeProviderRoute', () => {
  it('normalizes agy+grok to antigravity+grok', () => {
    expect(normalizeProviderRoute('agy+grok')).toBe('antigravity+grok');
  });

  it('normalizes comma-separated agy,grok to antigravity+grok', () => {
    expect(normalizeProviderRoute('agy,grok')).toBe('antigravity+grok');
  });

  it('normalizes greater-than separator agy>grok to antigravity+grok', () => {
    expect(normalizeProviderRoute('agy>grok')).toBe('antigravity+grok');
  });
});

describe('displayProviderRoute', () => {
  it('displays antigravity+grok as agy -> grok', () => {
    expect(displayProviderRoute('antigravity+grok')).toBe('agy -> grok');
  });

  it('displays single grok as grok', () => {
    expect(displayProviderRoute('grok')).toBe('grok');
  });
});
