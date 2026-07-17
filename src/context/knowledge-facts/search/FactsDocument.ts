export interface FactsDocument {
  id: string;
  factIndex: number;
  tokens: string[];
}

export interface FactsCorpusStats {
  avgDocLength: number;
  docFreq: Record<string, number>;
  totalDocs: number;
}

export interface FactsSearchIndex {
  builtAt: number;
  documents: FactsDocument[];
  stats: FactsCorpusStats;
}

export interface FactsSearchResult {
  document: FactsDocument;
  score: number;
}
