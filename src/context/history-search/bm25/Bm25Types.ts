export interface Bm25Config {
  k1: number;
  b: number;
  minTokenLength: number;
  maxResults: number;
}

export const DEFAULT_BM25_CONFIG: Bm25Config = {
  k1: 1.5,
  b: 0.75,
  minTokenLength: 2,
  maxResults: 20,
};
