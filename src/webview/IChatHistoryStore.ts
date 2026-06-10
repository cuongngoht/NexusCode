import type { ChatHistoryState } from '../core/chat/ChatHistory';

export interface IChatHistoryStore {
  load(): ChatHistoryState | null;
  save(history: ChatHistoryState): Promise<{ trimmedCount: number }>;
  clear(): Promise<void>;
}
