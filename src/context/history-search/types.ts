export interface SearchDocument {
  id: string;
  conversationId: string;
  messageId: string;
  role: 'user' | 'assistant';
  title: string;
  content: string;
  timestamp: number;
  provider?: string;
  mode?: string;
  model?: string;
  tokens: string[];
}

export interface SerializedHistorySearchIndex {
  version: 1;
  builtAt: number;
  sourceHistoryHash: string;
  documentCount: number;
  documents: SearchDocument[];
  stats: {
    avgDocLength: number;
    docFreq: Record<string, number>;
    totalDocs: number;
  };
}

export interface HistorySearchQuery {
  text: string;
  limit?: number;
  conversationId?: string;
  includeCurrentConversation?: boolean;
  roles?: Array<'user' | 'assistant'>;
  modes?: string[];
  from?: number;
  to?: number;
}

export interface HistorySearchResult {
  document: SearchDocument;
  score: number;
  highlights: string[];
  matchedTerms: string[];
}

export interface HistorySearchResultView {
  id: string;
  conversationId: string;
  conversationTitle: string;
  role: 'user' | 'assistant';
  excerpt: string;
  score: number;
  timestamp: number;
  mode?: string;
  provider?: string;
  matchedTerms: string[];
}

export interface HistoryRagSourceView {
  conversationId: string;
  conversationTitle: string;
  role: 'user' | 'assistant';
  score: number;
}

export interface HistoryIndexStatus {
  indexed: boolean;
  documentCount: number;
  builtAt?: number;
  stale: boolean;
}
