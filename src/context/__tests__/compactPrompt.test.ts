import { describe, it, expect } from 'vitest';
import { buildCompactPrompt } from '../compactPrompt';
import type { SerializedChatMessage } from '../../core/chat/ChatHistory';

describe('buildCompactPrompt', () => {
  const messages: SerializedChatMessage[] = [
    {
      id: '1',
      role: 'user',
      prompt: 'Fix the bug in auth.ts',
      provider: 'claude',
      mode: 'edit',
      timestamp: 1000,
    },
    {
      id: '2',
      role: 'assistant',
      providerLabel: 'Claude',
      mode: 'edit',
      content: 'I found the bug on line 42 and fixed it by checking for null.',
      timestamp: 2000,
    },
  ];

  it('includes user messages formatted as **User:**', () => {
    const prompt = buildCompactPrompt(messages);
    expect(prompt).toContain('**User:** Fix the bug in auth.ts');
  });

  it('includes assistant messages formatted as **Assistant:**', () => {
    const prompt = buildCompactPrompt(messages);
    expect(prompt).toContain('**Assistant:** I found the bug on line 42');
  });

  it('includes structured summary instructions', () => {
    const prompt = buildCompactPrompt(messages);
    expect(prompt).toContain('## Summary');
    expect(prompt).toContain('## Key Decisions');
    expect(prompt).toContain('## Technical Context');
  });

  it('truncates long assistant content at 3000 chars', () => {
    const longContent = 'x'.repeat(5000);
    const msgs: SerializedChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        providerLabel: 'Claude',
        mode: 'ask',
        content: longContent,
        timestamp: 1000,
      },
    ];
    const prompt = buildCompactPrompt(msgs);
    // 3000 + "**Assistant:** " prefix should be present
    expect(prompt).toContain('x'.repeat(3000));
    expect(prompt).not.toContain('x'.repeat(3001));
  });

  it('handles empty messages array', () => {
    const prompt = buildCompactPrompt([]);
    expect(prompt).toContain('## Summary');
  });
});
