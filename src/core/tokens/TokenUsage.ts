export type TokenUsageSource = 'exact' | 'estimated' | 'heuristic';

export interface TokenRunUsage {
  taskId: string;
  provider: string;
  providerLabel: string;
  mode: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  originalPromptTokens: number;
  enhancedPromptTokens: number;
  contextOverheadTokens: number;
  source: TokenUsageSource;
  tokenizer: string;
  startedAt: number;
  completedAt?: number;
}

export interface ProviderTokenSummary {
  provider: string;
  label: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  runs: number;
  sourceBreakdown: Record<TokenUsageSource, number>;
}

export interface ConversationTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  runs: number;
  byProvider: Record<string, ProviderTokenSummary>;
}
