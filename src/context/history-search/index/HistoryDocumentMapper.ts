import type { SerializedConversation, SerializedAssistantMessage } from '../../../core/chat/ChatHistory';
import type { SearchDocument } from '../types';
import { tokenize } from '../bm25/Bm25Tokenizer';

const MAX_CONTENT_LENGTH = 4000;

export class HistoryDocumentMapper {
  map(conv: SerializedConversation): SearchDocument[] {
    return conv.messages
      .filter(m => {
        if (m.role === 'user') return m.prompt.trim().length > 0;
        const a = m as SerializedAssistantMessage;
        return (a.content ?? '').trim().length > 0;
      })
      .map(m => {
        const content =
          m.role === 'user'
            ? m.prompt
            : ((m as SerializedAssistantMessage).content ?? '').slice(0, MAX_CONTENT_LENGTH);

        const provider =
          m.role === 'user'
            ? m.provider
            : (m as SerializedAssistantMessage).providerLabel;

        const model =
          m.role === 'user'
            ? m.model
            : (m as SerializedAssistantMessage).model;

        return {
          id: `${conv.id}::${m.id}`,
          conversationId: conv.id,
          messageId: m.id,
          role: m.role as 'user' | 'assistant',
          title: conv.title,
          content,
          timestamp: m.timestamp,
          provider,
          mode: m.mode,
          model,
          tokens: tokenize(conv.title + ' ' + content),
        } satisfies SearchDocument;
      });
  }
}
