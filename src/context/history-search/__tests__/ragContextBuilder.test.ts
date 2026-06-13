import { describe, it, expect } from 'vitest';
import { RagContextBuilder } from '../rag/RagContextBuilder';
import type { HistorySearchResult, SearchDocument } from '../types';

function makeResult(id: string, score: number, content: string, timestamp = 1000): HistorySearchResult {
  const doc: SearchDocument = {
    id,
    conversationId: `conv-${id}`,
    messageId: `msg-${id}`,
    role: 'user',
    title: `Conversation ${id}`,
    content,
    timestamp,
    tokens: [],
  };
  return { document: doc, score, highlights: [], matchedTerms: [] };
}

describe('RagContextBuilder', () => {
  const builder = new RagContextBuilder();

  it('returns empty string when no results', () => {
    expect(builder.build([])).toBe('');
  });

  it('returns empty string when all results are below minScore', () => {
    const results = [makeResult('a', 0.5, 'some content')];
    expect(builder.build(results, { minScore: 1.0 })).toBe('');
  });

  it('output contains the retrieved_chat_history tag', () => {
    const results = [makeResult('a', 2.0, 'TypeScript interfaces are useful')];
    const output = builder.build(results);
    expect(output).toContain('<retrieved_chat_history>');
    expect(output).toContain('</retrieved_chat_history>');
  });

  it('respects maxResults', () => {
    const results = [
      makeResult('a', 3.0, 'content a'),
      makeResult('b', 2.5, 'content b'),
      makeResult('c', 2.0, 'content c'),
    ];
    const output = builder.build(results, { maxResults: 2, minScore: 0 });
    expect(output).toContain('[1]');
    expect(output).toContain('[2]');
    expect(output).not.toContain('[3]');
  });

  it('respects maxChars', () => {
    const longContent = 'x'.repeat(500);
    const results = [
      makeResult('a', 3.0, longContent),
      makeResult('b', 2.5, longContent),
      makeResult('c', 2.0, longContent),
      makeResult('d', 1.5, longContent),
    ];
    const output = builder.build(results, { maxChars: 800, minScore: 0 });
    expect(output.length).toBeLessThanOrEqual(1000); // some overhead for tags
  });

  it('excludes results below minScore', () => {
    const results = [
      makeResult('a', 2.0, 'good result'),
      makeResult('b', 0.8, 'low score result'),
    ];
    const output = builder.build(results, { minScore: 1.5 });
    expect(output).toContain('good result');
    expect(output).not.toContain('low score result');
  });

  it('output is deterministic for the same input', () => {
    const results = [
      makeResult('a', 2.0, 'deterministic content'),
    ];
    const out1 = builder.build(results);
    const out2 = builder.build(results);
    expect(out1).toBe(out2);
  });

  it('includes conversation title and role in output', () => {
    const results = [makeResult('a', 2.0, 'some content')];
    const output = builder.build(results);
    expect(output).toContain('Conversation a');
    expect(output).toContain('user');
  });

  it('includes score in output', () => {
    const results = [makeResult('a', 3.14, 'some content')];
    const output = builder.build(results);
    expect(output).toContain('3.14');
  });
});
