export type ArchitectureDocumentSource = 'module' | 'violation' | 'layer' | 'rule';

export interface ArchitectureDocument {
  id: string;
  source: ArchitectureDocumentSource;
  section: string;
  content: string;
  tokens: string[];
}

export interface ArchitectureCorpusStats {
  avgDocLength: number;
  docFreq: Record<string, number>;
  totalDocs: number;
}

export interface ArchitectureSearchIndex {
  builtAt: number;
  detectedStyle: string;
  documents: ArchitectureDocument[];
  stats: ArchitectureCorpusStats;
}

export interface ArchitectureSearchResult {
  document: ArchitectureDocument;
  score: number;
}
