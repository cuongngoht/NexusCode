import type { ChatHistoryState, SerializedChatMessage } from '../core/chat/ChatHistory';

const CONTEXT_CHAR_LIMIT = 12_000;
const CONTEXT_MAX_MESSAGES = 8;

/**
 * Builds a plain-text conversation context string from the last few messages of
 * the active (or specified) conversation. Used to inject prior chat history into
 * the enhanced prompt so the agent has conversational continuity.
 *
 * This is prompt-formatting logic — it lives here in `src/context/`, not in the
 * HistoryHandler which is responsible only for storage I/O.
 */
export function buildConversationContext(
  history: ChatHistoryState | null,
  conversationId?: string,
): string | undefined {
  if (!history) return undefined;

  const targetId = conversationId ?? history.activeConversationId;
  const conv = history.conversations.find(c => c.id === targetId);
  if (!conv || conv.messages.length === 0) return undefined;

  const messages = conv.messages.slice(-CONTEXT_MAX_MESSAGES);
  const lines: string[] = [];
  let chars = 0;

  for (const m of messages) {
    let text: string;
    if (m.role === 'user') {
      text = `User: ${(m as Extract<SerializedChatMessage, { role: 'user' }>).prompt}`;
    } else {
      const a = m as Extract<SerializedChatMessage, { role: 'assistant' }>;
      text = `Assistant: ${a.content.slice(0, 2000)}`;
    }
    lines.push(text);
    chars += text.length;
    if (chars >= CONTEXT_CHAR_LIMIT) break;
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
}
