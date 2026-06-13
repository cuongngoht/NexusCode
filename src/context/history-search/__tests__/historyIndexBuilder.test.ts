import { describe, it, expect } from 'vitest';
import { HistoryIndexBuilder } from '../index/HistoryIndexBuilder';
import type { ChatHistoryState, SerializedConversation } from '../../../core/chat/ChatHistory';

function makeConversation(
  id: string,
  title: string,
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp?: number }>,
): SerializedConversation {
  return {
    id,
    title,
    createdAt: 1000,
    updatedAt: 2000,
    messages: messages.map(m =>
      m.role === 'user'
        ? {
            id: m.id,
            role: 'user' as const,
            prompt: m.content,
            provider: 'claude',
            mode: 'ask',
            timestamp: m.timestamp ?? 1000,
          }
        : {
            id: m.id,
            role: 'assistant' as const,
            providerLabel: 'Claude',
            mode: 'ask',
            content: m.content,
            timestamp: m.timestamp ?? 1000,
          },
    ),
  };
}

function makeHistory(conversations: SerializedConversation[]): ChatHistoryState {
  return {
    version: 1,
    activeConversationId: conversations[0]?.id ?? '',
    conversations,
  };
}

describe('HistoryIndexBuilder', () => {
  const builder = new HistoryIndexBuilder();

  it('maps user and assistant messages to documents', () => {
    const history = makeHistory([
      makeConversation('c1', 'Test Conv', [
        { id: 'm1', role: 'user', content: 'Hello world' },
        { id: 'm2', role: 'assistant', content: 'Hi there' },
      ]),
    ]);

    const index = builder.build(history);
    expect(index.documentCount).toBe(2);
    expect(index.documents).toHaveLength(2);

    const roles = index.documents.map(d => d.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });

  it('skips empty messages', () => {
    const history = makeHistory([
      makeConversation('c1', 'Test', [
        { id: 'm1', role: 'user', content: '' },
        { id: 'm2', role: 'user', content: '   ' },
        { id: 'm3', role: 'user', content: 'Valid message' },
      ]),
    ]);

    const index = builder.build(history);
    expect(index.documentCount).toBe(1);
  });

  it('computes avgDocLength correctly', () => {
    const history = makeHistory([
      makeConversation('c1', 'T', [
        { id: 'm1', role: 'user', content: 'one two three' },
        { id: 'm2', role: 'user', content: 'four five six seven' },
      ]),
    ]);

    const index = builder.build(history);
    expect(index.stats.avgDocLength).toBeGreaterThan(0);
    expect(index.stats.totalDocs).toBe(2);
  });

  it('computes docFreq for shared terms', () => {
    const history = makeHistory([
      makeConversation('c1', 'shared', [
        { id: 'm1', role: 'user', content: 'TypeScript is great' },
        { id: 'm2', role: 'user', content: 'TypeScript is fast' },
      ]),
    ]);

    const index = builder.build(history);
    // 'typescript' should appear in both documents → docFreq >= 2
    const tsFreq = index.stats.docFreq['typescript'] ?? 0;
    expect(tsFreq).toBeGreaterThanOrEqual(2);
  });

  it('produces a stable hash for the same history', () => {
    const history = makeHistory([
      makeConversation('c1', 'Conv', [
        { id: 'm1', role: 'user', content: 'hello' },
      ]),
    ]);

    const h1 = builder.hash(history);
    const h2 = builder.hash(history);
    expect(h1).toBe(h2);
  });

  it('produces a different hash when history changes', () => {
    const h1 = builder.hash(makeHistory([
      makeConversation('c1', 'Conv', [{ id: 'm1', role: 'user', content: 'hello' }]),
    ]));

    const h2 = builder.hash(makeHistory([
      makeConversation('c1', 'Conv', [
        { id: 'm1', role: 'user', content: 'hello' },
        { id: 'm2', role: 'user', content: 'world' },
      ]),
    ]));

    expect(h1).not.toBe(h2);
  });

  it('handles empty history', () => {
    const index = builder.build(makeHistory([]));
    expect(index.documentCount).toBe(0);
    expect(index.stats.avgDocLength).toBe(0);
  });

  it('includes version 1 and builtAt in the index', () => {
    const before = Date.now();
    const index = builder.build(makeHistory([]));
    const after = Date.now();
    expect(index.version).toBe(1);
    expect(index.builtAt).toBeGreaterThanOrEqual(before);
    expect(index.builtAt).toBeLessThanOrEqual(after);
  });
});
