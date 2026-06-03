import * as vscode from 'vscode';
import type { ChatHistoryState, SerializedConversation } from '../core/chat/ChatHistory';

const HISTORY_KEY = 'nexus.chatHistory.v1';
const MAX_CONVERSATIONS = 50;

export class ChatHistoryStore {
  constructor(private readonly memento: vscode.Memento) {}

  load(): ChatHistoryState | null {
    try {
      const raw = this.memento.get<unknown>(HISTORY_KEY);
      if (!raw || typeof raw !== 'object') return null;
      const data = raw as Record<string, unknown>;
      if (data['version'] !== 1 || !Array.isArray(data['conversations'])) return null;
      return raw as ChatHistoryState;
    } catch {
      return null;
    }
  }

  async save(history: ChatHistoryState): Promise<void> {
    const trimmed: ChatHistoryState = {
      ...history,
      conversations: trimToLimit(history.conversations),
    };
    await this.memento.update(HISTORY_KEY, trimmed);
  }

  async clear(): Promise<void> {
    await this.memento.update(HISTORY_KEY, undefined);
  }
}

function trimToLimit(conversations: SerializedConversation[]): SerializedConversation[] {
  if (conversations.length <= MAX_CONVERSATIONS) return conversations;
  return [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS);
}
