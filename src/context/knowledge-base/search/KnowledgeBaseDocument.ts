export interface KnowledgeBaseDocument {
  id: string;
  entryIndex: number;
  tokens: string[];
}

export interface KnowledgeBaseCorpusStats {
  avgDocLength: number;
  docFreq: Record<string, number>;
  totalDocs: number;
}

export interface KnowledgeBaseSearchIndex {
  builtAt: number;
  documents: KnowledgeBaseDocument[];
  stats: KnowledgeBaseCorpusStats;
}

export interface KnowledgeBaseSearchResult {
  document: KnowledgeBaseDocument;
  score: number;
}
