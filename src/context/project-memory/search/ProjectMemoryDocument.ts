export interface ProjectMemoryDocument {
  id: string;
  source: 'project-map' | 'workspace-units' | 'discovery';
  section: string;
  content: string;
  tokens: string[];
  sourcePaths?: string[];   // absolute FS paths this chunk was derived from (for staleness validation)
}

export interface ProjectMemoryCorpusStats {
  avgDocLength: number;
  docFreq: Record<string, number>;
  totalDocs: number;
}

export interface ProjectMemorySearchIndex {
  version: 1;
  builtAt: number;
  manifestScanId: string;
  documents: ProjectMemoryDocument[];
  stats: ProjectMemoryCorpusStats;
}

export interface ProjectMemorySearchResult {
  document: ProjectMemoryDocument;
  score: number;
}
