export interface SerializedUserMessage {
  id: string;
  role: 'user';
  prompt: string;
  provider: string;
  mode: string;
  model?: string;
  timestamp: number;
}

export interface SerializedAssistantMessage {
  id: string;
  role: 'assistant';
  providerLabel: string;
  mode: string;
  model?: string;
  content: string;
  exitCode?: number;
  errorText?: string;
  timestamp: number;
}

export type SerializedChatMessage = SerializedUserMessage | SerializedAssistantMessage;

export interface SerializedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: SerializedChatMessage[];
  gitChanges?: { status: string; path: string }[];
  gitMessage?: string;
}

export interface ChatHistoryState {
  version: 1;
  activeConversationId: string;
  conversations: SerializedConversation[];
}
