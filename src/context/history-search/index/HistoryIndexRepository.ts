import type { SerializedHistorySearchIndex } from '../types';

export interface HistoryIndexRepository {
  load(): SerializedHistorySearchIndex | null;
  save(index: SerializedHistorySearchIndex): void;
  clear(): void;
}
