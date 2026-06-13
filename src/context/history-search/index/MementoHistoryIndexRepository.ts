import type { HistoryIndexRepository } from './HistoryIndexRepository';
import type { SerializedHistorySearchIndex } from '../types';

// Duck-typed Memento interface — does not import VS Code directly so this module
// stays importable from non-extension contexts (tests, CLI).
export interface VsCodeMemento {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

const INDEX_KEY = 'nexus.historySearch.v1.index';
const META_KEY = 'nexus.historySearch.v1.meta';

export class MementoHistoryIndexRepository implements HistoryIndexRepository {
  constructor(private readonly memento: VsCodeMemento) {}

  load(): SerializedHistorySearchIndex | null {
    try {
      const raw = this.memento.get<unknown>(INDEX_KEY);
      if (!raw || typeof raw !== 'object') return null;
      const idx = raw as Partial<SerializedHistorySearchIndex>;
      if (idx.version !== 1 || !Array.isArray(idx.documents)) return null;
      return raw as SerializedHistorySearchIndex;
    } catch {
      return null;
    }
  }

  save(index: SerializedHistorySearchIndex): void {
    void this.memento.update(INDEX_KEY, index);
    void this.memento.update(META_KEY, {
      documentCount: index.documentCount,
      builtAt: index.builtAt,
    });
  }

  clear(): void {
    void this.memento.update(INDEX_KEY, undefined);
    void this.memento.update(META_KEY, undefined);
  }
}
