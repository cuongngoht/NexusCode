import type { ExtensionMessage } from '../webviewProtocol';
import { ChatHistoryStore } from '../ChatHistoryStore';
import type { ChatHistoryState, SerializedChatMessage } from '../../core/chat/ChatHistory';

const CONTEXT_CHAR_LIMIT = 12_000;
const CONTEXT_MAX_MESSAGES = 8;

export class HistoryHandler {
  private _latestHistory: ChatHistoryState | null = null;

  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly store: ChatHistoryStore,
  ) {}

  get latestHistory(): ChatHistoryState | null {
    return this._latestHistory;
  }

  async load(): Promise<void> {
    try {
      const history = this.store.load();
      if (history) {
        this._latestHistory = history;
        this.post({ type: 'historyLoaded', history });
      }
    } catch (err) {
      this.post({ type: 'historyError', message: String(err) });
    }
  }

  async save(history: ChatHistoryState): Promise<void> {
    this._latestHistory = history;
    await this.store.save(history);
  }

  buildConversationContext(): string | undefined {
    const history = this._latestHistory;
    if (!history) return undefined;

    const conv = history.conversations.find(c => c.id === history.activeConversationId);
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
}
