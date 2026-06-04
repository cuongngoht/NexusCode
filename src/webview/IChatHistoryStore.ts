import type { ChatHistoryState } from '../core/chat/ChatHistory';

export interface IChatHistoryStore {
  load(): ChatHistoryState | null;
  save(history: ChatHistoryState): Promise<void>;
  clear(): Promise<void>;
}
