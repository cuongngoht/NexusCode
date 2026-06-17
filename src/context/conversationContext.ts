import type { ChatHistoryState, SerializedChatMessage } from '../core/chat/ChatHistory';

const CONTEXT_CHAR_LIMIT_DEFAULT = 100_000;
const CONTEXT_MAX_MESSAGES_DEFAULT = 20;
const RECENT_MESSAGES_AFTER_COMPACT = 6;
const ASSISTANT_CONTENT_LIMIT = 2_000;

/**
 * Builds a plain-text conversation context string from the last few messages of
 * the active (or specified) conversation. Used to inject prior chat history into
 * the enhanced prompt so the agent has conversational continuity.
 *
 * When a compact summary exists, it is injected first and only the messages that
 * came after the compact point are included as "recent conversation".
 */
export function buildConversationContext(
  history: ChatHistoryState | null,
  conversationId?: string,
  options?: { maxChars?: number; maxMessages?: number },
): string | undefined {
  const CONTEXT_CHAR_LIMIT = options?.maxChars ?? CONTEXT_CHAR_LIMIT_DEFAULT;
  const CONTEXT_MAX_MESSAGES = options?.maxMessages ?? CONTEXT_MAX_MESSAGES_DEFAULT;

  if (!history) return undefined;

  const targetId = conversationId ?? history.activeConversationId;
  const conv = history.conversations.find(c => c.id === targetId);
  if (!conv || conv.messages.length === 0) return undefined;

  if (conv.compactSummary) {
    const { compactSummary } = conv;
    const startIdx = compactSummary.sourceLastMessageId
      ? conv.messages.findIndex(m => m.id === compactSummary.sourceLastMessageId) + 1
      : Math.max(0, conv.messages.length - RECENT_MESSAGES_AFTER_COMPACT);
    const recentMessages = conv.messages.slice(startIdx).slice(-CONTEXT_MAX_MESSAGES);

    const parts: string[] = [
      '## Compact Conversation Summary',
      compactSummary.content,
      '',
    ];

    if (recentMessages.length > 0) {
      parts.push('## Recent Conversation');
      for (const m of recentMessages) {
        if (m.role === 'user') {
          parts.push(`User: ${(m as Extract<SerializedChatMessage, { role: 'user' }>).prompt}`);
        } else {
          const a = m as Extract<SerializedChatMessage, { role: 'assistant' }>;
          parts.push(`Assistant: ${a.content.slice(0, ASSISTANT_CONTENT_LIMIT)}`);
        }
      }
    }

    return parts.join('\n');
  }

  const messages = conv.messages.slice(-CONTEXT_MAX_MESSAGES);
  const lines: string[] = [];
  let chars = 0;

  for (const m of messages) {
    let text: string;
    if (m.role === 'user') {
      text = `User: ${(m as Extract<SerializedChatMessage, { role: 'user' }>).prompt}`;
    } else {
      const a = m as Extract<SerializedChatMessage, { role: 'assistant' }>;
      text = `Assistant: ${a.content.slice(0, ASSISTANT_CONTENT_LIMIT)}`;
    }
    lines.push(text);
    chars += text.length;
    if (chars >= CONTEXT_CHAR_LIMIT) break;
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
}
