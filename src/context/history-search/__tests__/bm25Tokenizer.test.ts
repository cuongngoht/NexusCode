import { describe, it, expect } from 'vitest';
import { tokenize } from '../bm25/Bm25Tokenizer';

describe('tokenize', () => {
  it('tokenizes Vietnamese text', () => {
    const tokens = tokenize('Xin chào thế giới');
    expect(tokens).toContain('xin');
    expect(tokens).toContain('chào');
    expect(tokens).toContain('thế');
    expect(tokens).toContain('giới');
  });

  it('splits CamelCase identifiers and keeps original', () => {
    const tokens = tokenize('NexusOrchestrator');
    expect(tokens).toContain('nexusorchestrator');
    expect(tokens).toContain('nexus');
    expect(tokens).toContain('orchestrator');
  });

  it('splits file paths on dot and slash', () => {
    const tokens = tokenize('src/webview-ui/messages.ts');
    expect(tokens).toContain('src');
    expect(tokens).toContain('webview');
    expect(tokens).toContain('ui');
    expect(tokens).toContain('messages');
    expect(tokens).toContain('ts');
  });

  it('splits CLI flags', () => {
    const tokens = tokenize('--auto-approve');
    expect(tokens).toContain('auto');
    expect(tokens).toContain('approve');
    expect(tokens).toContain('auto-approve');
  });

  it('filters tokens shorter than minTokenLength', () => {
    const tokens = tokenize('a bb ccc', 2);
    expect(tokens).not.toContain('a');
    expect(tokens).toContain('bb');
    expect(tokens).toContain('ccc');
  });

  it('filters out tokens with no alphanumeric characters', () => {
    const tokens = tokenize('hello, world!');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    // punctuation-only should be excluded
    tokens.forEach(t => {
      expect(/[\p{L}\p{N}]/u.test(t)).toBe(true);
    });
  });

  it('handles @agent and #skill tokens', () => {
    const tokens = tokenize('@my-agent #my-skill');
    expect(tokens).toContain('my');
    expect(tokens).toContain('agent');
    expect(tokens).toContain('skill');
  });

  it('handles mixed English and Vietnamese text', () => {
    const tokens = tokenize('TypeScript là ngôn ngữ lập trình');
    expect(tokens).toContain('typescript');
    expect(tokens).toContain('là');
    expect(tokens).toContain('ngôn');
    expect(tokens).toContain('ngữ');
  });

  it('returns unique tokens', () => {
    const tokens = tokenize('hello hello world');
    const tokenSet = new Set(tokens);
    expect(tokenSet.size).toBe(tokens.length);
  });
});
