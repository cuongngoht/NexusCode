import { describe, it, expect, beforeEach } from 'vitest';
import { HistorySearchService } from '../HistorySearchService';
import { HistoryIndexBuilder } from '../index/HistoryIndexBuilder';
import { Bm25HistorySearchStrategy } from '../bm25/Bm25HistorySearchStrategy';
import { InMemoryBm25Engine } from '../bm25/InMemoryBm25Engine';
import type { HistoryIndexRepository } from '../index/HistoryIndexRepository';
import type { SerializedHistorySearchIndex } from '../types';
import type { ChatHistoryState, SerializedConversation } from '../../../core/chat/ChatHistory';

class NoopRepo implements HistoryIndexRepository {
  load(): SerializedHistorySearchIndex | null { return null; }
  save(): void {}
  clear(): void {}
}

function makeHistory(conversations: SerializedConversation[]): ChatHistoryState {
  return { version: 1, activeConversationId: conversations[0]?.id ?? '', conversations };
}

function makeConv(id: string, messages: Array<{ role: 'user' | 'assistant'; content: string; mode?: string }>): SerializedConversation {
  return {
    id,
    title: `Conv ${id}`,
    createdAt: 1000,
    updatedAt: 2000,
    messages: messages.map((m, i) =>
      m.role === 'user'
        ? { id: `${id}-m${i}`, role: 'user' as const, prompt: m.content, provider: 'claude', mode: m.mode ?? 'ask', timestamp: 1000 + i }
        : { id: `${id}-m${i}`, role: 'assistant' as const, providerLabel: 'Claude', mode: m.mode ?? 'ask', content: m.content, timestamp: 1000 + i },
    ),
  };
}

describe('HistorySearchService', () => {
  let service: HistorySearchService;

  beforeEach(() => {
    const engine = new InMemoryBm25Engine();
    const strategy = new Bm25HistorySearchStrategy(engine);
    const builder = new HistoryIndexBuilder();
    service = new HistorySearchService(strategy, builder, new NoopRepo());
  });

  it('returns empty results when index is not built', () => {
    const results = service.search({ text: 'hello' });
    expect(results).toHaveLength(0);
  });

  it('returns relevant results for a matching query', async () => {
    const history = makeHistory([
      makeConv('c1', [{ role: 'user', content: 'How to use TypeScript generics effectively' }]),
      makeConv('c2', [{ role: 'user', content: 'What is the weather today in Hanoi' }]),
    ]);

    await service.rebuildIndex(history);
    const results = service.search({ text: 'TypeScript generics' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document.conversationId).toBe('c1');
  });

  it('filters results by role', async () => {
    const history = makeHistory([
      makeConv('c1', [
        { role: 'user', content: 'explain TypeScript interfaces' },
        { role: 'assistant', content: 'TypeScript interfaces define contracts' },
      ]),
    ]);

    await service.rebuildIndex(history);

    const userOnly = service.search({ text: 'TypeScript', roles: ['user'] });
    const assistantOnly = service.search({ text: 'TypeScript', roles: ['assistant'] });

    expect(userOnly.every(r => r.document.role === 'user')).toBe(true);
    expect(assistantOnly.every(r => r.document.role === 'assistant')).toBe(true);
  });

  it('filters results by mode', async () => {
    const history = makeHistory([
      makeConv('c1', [
        { role: 'user', content: 'fix the TypeScript error', mode: 'debug' },
        { role: 'user', content: 'TypeScript best practices', mode: 'ask' },
      ]),
    ]);

    await service.rebuildIndex(history);

    const debugOnly = service.search({ text: 'TypeScript', modes: ['debug'] });
    expect(debugOnly.every(r => r.document.mode === 'debug')).toBe(true);
  });

  it('rebuilds stale index when hash changes', async () => {
    const history1 = makeHistory([
      makeConv('c1', [{ role: 'user', content: 'first message' }]),
    ]);
    await service.rebuildIndex(history1);

    const status1 = service.getIndexStatus();
    expect(status1.documentCount).toBe(1);

    const history2 = makeHistory([
      makeConv('c1', [
        { role: 'user', content: 'first message' },
        { role: 'user', content: 'second message added' },
      ]),
    ]);
    await service.rebuildIndex(history2);

    const status2 = service.getIndexStatus();
    expect(status2.documentCount).toBe(2);
  });

  it('clearIndex resets state', async () => {
    const history = makeHistory([
      makeConv('c1', [{ role: 'user', content: 'test message' }]),
    ]);
    await service.rebuildIndex(history);
    expect(service.getIndexStatus().indexed).toBe(true);

    service.clearIndex();
    expect(service.getIndexStatus().indexed).toBe(false);
    expect(service.getIndexStatus().documentCount).toBe(0);
    expect(service.search({ text: 'test' })).toHaveLength(0);
  });

  it('ensureIndex uses persisted index when hash matches', async () => {
    // Build a persisted index
    let savedIndex: SerializedHistorySearchIndex | null = null;
    const persistingRepo: HistoryIndexRepository = {
      load: () => savedIndex,
      save: (idx) => { savedIndex = idx; },
      clear: () => { savedIndex = null; },
    };

    const engine = new InMemoryBm25Engine();
    const strategy = new Bm25HistorySearchStrategy(engine);
    const builder = new HistoryIndexBuilder();
    const svc2 = new HistorySearchService(strategy, builder, persistingRepo);

    const history = makeHistory([
      makeConv('c1', [{ role: 'user', content: 'persisted content about React hooks' }]),
    ]);

    await svc2.rebuildIndex(history);
    expect(savedIndex).not.toBeNull();

    // New service instance — should load from repo
    const engine2 = new InMemoryBm25Engine();
    const strategy2 = new Bm25HistorySearchStrategy(engine2);
    const svc3 = new HistorySearchService(strategy2, builder, persistingRepo);
    await svc3.ensureIndex(history);

    const results = svc3.search({ text: 'React hooks' });
    expect(results.length).toBeGreaterThan(0);
  });
});
