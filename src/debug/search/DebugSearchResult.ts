export interface DebugSearchResult {
  path: string;
  score: number;
  reason?: string;
  matchedTerms?: string[];
  snippet?: string;
}
