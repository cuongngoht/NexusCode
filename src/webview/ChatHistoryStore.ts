import * as vscode from 'vscode';
import type { ChatHistoryState, SerializedConversation } from '../core/chat/ChatHistory';
import type { IChatHistoryStore } from './IChatHistoryStore';

// v1: single monolithic key (legacy)
const V1_KEY = 'nexus.chatHistory.v1';

// v2: one key per conversation + a small index
const V2_INDEX_KEY = 'nexus.chatHistory.v2.index';
const convKey = (id: string) => `nexus.chatHistory.v2.conv.${id}`;

const MAX_CONVERSATIONS = 50;

interface V2Index {
  version: 2;
  activeConversationId: string;
  conversationIds: string[];
}

export class ChatHistoryStore implements IChatHistoryStore {
  constructor(private readonly memento: vscode.Memento) {}

  load(): ChatHistoryState | null {
    // Prefer v2 (per-conversation keys)
    const index = this.loadV2Index();
    if (index) {
      const conversations = index.conversationIds
        .map(id => this.loadV2Conv(id))
        .filter((c): c is SerializedConversation => c !== null);
      if (conversations.length > 0) {
        return { version: 1, activeConversationId: index.activeConversationId, conversations };
      }
    }

    // Fall back to v1 (will be migrated on next save)
    return this.loadV1();
  }

  async save(history: ChatHistoryState): Promise<void> {
    const trimmed = trimToLimit(history.conversations);
    const newIds = new Set(trimmed.map(c => c.id));

    // Remove keys for conversations that were trimmed or deleted
    const oldIndex = this.loadV2Index();
    if (oldIndex) {
      for (const id of oldIndex.conversationIds) {
        if (!newIds.has(id)) {
          await this.memento.update(convKey(id), undefined);
        }
      }
    }

    // Write each conversation to its own key
    for (const conv of trimmed) {
      await this.memento.update(convKey(conv.id), conv);
    }

    // Write the index
    const v2Index: V2Index = {
      version: 2,
      activeConversationId: history.activeConversationId,
      conversationIds: trimmed.map(c => c.id),
    };
    await this.memento.update(V2_INDEX_KEY, v2Index);

    // Migrate: erase the old v1 blob once v2 is written
    if (this.memento.get(V1_KEY) !== undefined) {
      await this.memento.update(V1_KEY, undefined);
    }
  }

  async clear(): Promise<void> {
    const index = this.loadV2Index();
    if (index) {
      for (const id of index.conversationIds) {
        await this.memento.update(convKey(id), undefined);
      }
      await this.memento.update(V2_INDEX_KEY, undefined);
    }
    await this.memento.update(V1_KEY, undefined);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private loadV2Index(): V2Index | null {
    try {
      const raw = this.memento.get<unknown>(V2_INDEX_KEY);
      if (!raw || typeof raw !== 'object') return null;
      const data = raw as Record<string, unknown>;
      if (data['version'] !== 2 || !Array.isArray(data['conversationIds'])) return null;
      return raw as V2Index;
    } catch {
      return null;
    }
  }

  private loadV2Conv(id: string): SerializedConversation | null {
    try {
      const raw = this.memento.get<unknown>(convKey(id));
      if (!raw || typeof raw !== 'object') return null;
      return raw as SerializedConversation;
    } catch {
      return null;
    }
  }

  private loadV1(): ChatHistoryState | null {
    try {
      const raw = this.memento.get<unknown>(V1_KEY);
      if (!raw || typeof raw !== 'object') return null;
      const data = raw as Record<string, unknown>;
      if (data['version'] !== 1 || !Array.isArray(data['conversations'])) return null;
      return raw as ChatHistoryState;
    } catch {
      return null;
    }
  }
}

function trimToLimit(conversations: SerializedConversation[]): SerializedConversation[] {
  if (conversations.length <= MAX_CONVERSATIONS) return conversations;
  return [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS);
}
