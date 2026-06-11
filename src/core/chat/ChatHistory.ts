export interface SerializedUserMessage {
  id: string;
  role: 'user';
  prompt: string;
  provider: string;
  mode: string;
  model?: string;
  timestamp: number;
}

import type { TokenRunUsage } from '../tokens/TokenUsage';

export interface EnhancedPromptSection {
  title: string;
  charCount: number;
}

export interface EnhancedPromptSnapshotMeta {
  originalPrompt: string;
  wasTruncated: boolean;
  sectionTitles: string[];
  charCounts: Record<string, number>;
  generatedAt: number;
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
  tokenUsage?: TokenRunUsage;
  enhancedPromptMeta?: EnhancedPromptSnapshotMeta;
  feedback?: { rating: 'good' | 'bad' | null; ratedAt?: number };
  retrySourceMessageId?: string;
  elapsed?: number;
}

export type SerializedChatMessage = SerializedUserMessage | SerializedAssistantMessage;

export interface SerializedConversationCompactSummary {
  content: string;
  createdAt: number;
  updatedAt: number;
  sourceMessageCount: number;
  sourceLastMessageId?: string;
  provider?: string;
  model?: string;
}

export interface SerializedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: SerializedChatMessage[];
  gitChanges?: { status: string; path: string }[];
  gitMessage?: string;
  compactSummary?: SerializedConversationCompactSummary;
}

export interface ChatHistoryState {
  version: 1;
  activeConversationId: string;
  conversations: SerializedConversation[];
}
