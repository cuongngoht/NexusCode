import { describe, it, expect } from 'vitest';
import { tokenize, tokenizePath } from './Bm25Tokenizer';

describe('tokenize', () => {
  it('lowercases all tokens', () => {
    const tokens = tokenize('HelloWorld FooBar');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('foo');
    expect(tokens).toContain('bar');
  });

  it('preserves TypeScript error codes like TS2345', () => {
    const tokens = tokenize('error TS2345: Argument of type');
    expect(tokens).toContain('ts2345');
  });

  it('splits camelCase', () => {
    const tokens = tokenize('runTaskHandler');
    expect(tokens).toContain('run');
    expect(tokens).toContain('task');
    expect(tokens).toContain('handler');
  });

  it('splits PascalCase', () => {
    const tokens = tokenize('ChatController');
    expect(tokens).toContain('chat');
    expect(tokens).toContain('controller');
  });

  it('splits on path separators', () => {
    const tokens = tokenize('src/webview/handlers/RunTaskHandler.ts');
    expect(tokens).toContain('src');
    expect(tokens).toContain('webview');
    expect(tokens).toContain('handlers');
    expect(tokens).toContain('run');
    expect(tokens).toContain('task');
    expect(tokens).toContain('handler');
  });

  it('splits on dots and underscores', () => {
    const tokens = tokenize('my_file.test.ts');
    expect(tokens).toContain('my');
    expect(tokens).toContain('file');
    expect(tokens).toContain('test');
    expect(tokens).toContain('ts');
  });

  it('filters very short tokens (< 2 chars) unless known extension', () => {
    const tokens = tokenize('a b c foo');
    // 'a', 'b', 'c' should be dropped (< 2 chars and not in TOOL_SHORT)
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('b');
    expect(tokens).not.toContain('c');
    expect(tokens).toContain('foo');
  });

  it('keeps ts as a known short token', () => {
    const tokens = tokenize('typescript ts');
    expect(tokens).toContain('ts');
  });

  it('deduplicates tokens', () => {
    const tokens = tokenize('foo foo bar foo');
    const fooCount = tokens.filter(t => t === 'foo').length;
    expect(fooCount).toBe(1);
  });
});

describe('tokenizePath', () => {
  it('extracts directory and filename tokens', () => {
    const tokens = tokenizePath('src/debug/DebugInputParser.ts');
    expect(tokens).toContain('src');
    expect(tokens).toContain('debug');
    expect(tokens).toContain('input');
    expect(tokens).toContain('parser');
  });

  it('includes the full lowercase filename', () => {
    const tokens = tokenizePath('src/debug/DebugInputParser.ts');
    expect(tokens).toContain('debuginputparser.ts');
  });
});
