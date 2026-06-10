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
        // Ensure activeConversationId actually exists in the loaded set
        const activeExists = conversations.some(c => c.id === index.activeConversationId);
        const activeConversationId = activeExists ? index.activeConversationId : conversations[0].id;
        return { version: 1, activeConversationId, conversations };
      }
    }

    // Fall back to v1 (will be migrated on next save)
    return this.loadV1();
  }

  async save(history: ChatHistoryState): Promise<{ trimmedCount: number }> {
    const trimmed = trimToLimit(history.conversations);
    const trimmedCount = history.conversations.length - trimmed.length;
    const newIds = new Set(trimmed.map(c => c.id));

    // Capture old IDs before any write so GC after index update is safe
    const oldIndex = this.loadV2Index();
    const oldIds: string[] = oldIndex?.conversationIds ?? [];

    // Step 1: Write all new conversation blobs first.
    // If we crash here, the index still points to old valid data.
    for (const conv of trimmed) {
      await this.memento.update(convKey(conv.id), conv);
    }

    // Step 2: Update the index (all new keys exist at this point).
    await this.memento.update(V2_INDEX_KEY, {
      version: 2,
      activeConversationId: history.activeConversationId,
      conversationIds: trimmed.map(c => c.id),
    } satisfies V2Index);

    // Step 3: GC old keys no longer referenced by the index.
    // write-before-delete ensures we never lose data on crash.
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        await this.memento.update(convKey(id), undefined);
      }
    }

    // Step 4: Migrate: erase the old v1 blob once v2 is committed.
    if (this.memento.get(V1_KEY) !== undefined) {
      await this.memento.update(V1_KEY, undefined);
    }

    return { trimmedCount };
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
      if (data['version'] !== 2) return null;
      if (!Array.isArray(data['conversationIds'])) return null;
      if (typeof data['activeConversationId'] !== 'string') return null;
      return raw as V2Index;
    } catch {
      return null;
    }
  }

  private loadV2Conv(id: string): SerializedConversation | null {
    try {
      const raw = this.memento.get<unknown>(convKey(id));
      if (!raw || typeof raw !== 'object') return null;
      const d = raw as Record<string, unknown>;
      if (typeof d['id'] !== 'string' || !d['id']) return null;
      if (typeof d['title'] !== 'string') return null;
      if (!Array.isArray(d['messages'])) return null;
      if (typeof d['createdAt'] !== 'number') return null;
      if (typeof d['updatedAt'] !== 'number') return null;
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
