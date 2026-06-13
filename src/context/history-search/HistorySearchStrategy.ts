import type { HistorySearchQuery, HistorySearchResult, SerializedHistorySearchIndex } from './types';

export interface HistorySearchStrategy {
  search(query: HistorySearchQuery): HistorySearchResult[];
  loadIndex(index: SerializedHistorySearchIndex): void;
  clear(): void;
}
