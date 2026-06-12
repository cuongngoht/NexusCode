import { describe, it, expect } from 'vitest';
import { buildConversationContext } from '../conversationContext';
import type { ChatHistoryState } from '../../core/chat/ChatHistory';

const baseHistory: ChatHistoryState = {
  version: 1,
  activeConversationId: 'conv1',
  conversations: [
    {
      id: 'conv1',
      title: 'Test',
      createdAt: 1000,
      updatedAt: 2000,
      messages: [
        { id: 'm1', role: 'user', prompt: 'first question', provider: 'claude', mode: 'ask', timestamp: 1000 },
        { id: 'm2', role: 'assistant', providerLabel: 'Claude', mode: 'ask', content: 'first answer', timestamp: 2000 },
        { id: 'm3', role: 'user', prompt: 'second question', provider: 'claude', mode: 'ask', timestamp: 3000 },
        { id: 'm4', role: 'assistant', providerLabel: 'Claude', mode: 'ask', content: 'second answer', timestamp: 4000 },
      ],
    },
  ],
};

describe('buildConversationContext — without compact summary', () => {
  it('returns undefined for empty history', () => {
    expect(buildConversationContext(null)).toBeUndefined();
  });

  it('builds context from recent messages', () => {
    const ctx = buildConversationContext(baseHistory);
    expect(ctx).toContain('User: first question');
    expect(ctx).toContain('Assistant: first answer');
    expect(ctx).toContain('User: second question');
  });
});

describe('buildConversationContext — with compact summary', () => {
  const historyWithCompact: ChatHistoryState = {
    ...baseHistory,
    conversations: [
      {
        ...baseHistory.conversations[0],
        compactSummary: {
          content: '## Summary\nThis conversation fixed auth bugs.\n\n## Key Decisions\n- Use null checks',
          createdAt: 1500,
          updatedAt: 1500,
          sourceMessageCount: 2,
          sourceLastMessageId: 'm2',
        },
      },
    ],
  };

  it('injects compact summary section before recent messages', () => {
    const ctx = buildConversationContext(historyWithCompact);
    expect(ctx).toContain('## Compact Conversation Summary');
    expect(ctx).toContain('## Summary\nThis conversation fixed auth bugs.');
  });

  it('includes only messages after sourceLastMessageId', () => {
    const ctx = buildConversationContext(historyWithCompact);
    // m3 and m4 come after m2 (the sourceLastMessageId)
    expect(ctx).toContain('User: second question');
    expect(ctx).toContain('Assistant: second answer');
    // m1 is before the compact point
    expect(ctx).not.toContain('User: first question');
  });

  it('falls back to last N messages when no sourceLastMessageId', () => {
    const historyNoId: ChatHistoryState = {
      ...baseHistory,
      conversations: [
        {
          ...baseHistory.conversations[0],
          compactSummary: {
            content: 'Summary content',
            createdAt: 1500,
            updatedAt: 1500,
            sourceMessageCount: 2,
          },
        },
      ],
    };
    const ctx = buildConversationContext(historyNoId);
    expect(ctx).toContain('## Compact Conversation Summary');
    expect(ctx).toContain('Summary content');
  });

  it('includes ## Recent Conversation header when recent messages exist', () => {
    const ctx = buildConversationContext(historyWithCompact);
    expect(ctx).toContain('## Recent Conversation');
  });
});
