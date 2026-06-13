import type { ChatHistoryState } from '../../core/chat/ChatHistory';
import type { HistorySearchStrategy } from './HistorySearchStrategy';
import type { HistoryIndexRepository } from './index/HistoryIndexRepository';
import type { HistoryIndexBuilder } from './index/HistoryIndexBuilder';
import type { HistoryIndexStatus, HistorySearchQuery, HistorySearchResult } from './types';

export class HistorySearchService {
  private currentHash: string | null = null;
  private indexed = false;
  private builtAt?: number;
  private documentCount = 0;

  constructor(
    private readonly strategy: HistorySearchStrategy,
    private readonly builder: HistoryIndexBuilder,
    private readonly repo: HistoryIndexRepository,
  ) {}

  async ensureIndex(history: ChatHistoryState): Promise<void> {
    const newHash = this.builder.hash(history);

    // Try loading a persisted index first if we haven't indexed yet
    if (!this.indexed) {
      const persisted = this.repo.load();
      if (persisted && persisted.sourceHistoryHash === newHash) {
        this.strategy.loadIndex(persisted);
        this.indexed = true;
        this.currentHash = newHash;
        this.builtAt = persisted.builtAt;
        this.documentCount = persisted.documentCount;
        return;
      }
    }

    // Already indexed and hash matches — nothing to do
    if (this.currentHash === newHash && this.indexed) return;

    await this.rebuildIndex(history);
  }

  async rebuildIndex(history: ChatHistoryState): Promise<void> {
    const index = this.builder.build(history);
    this.strategy.loadIndex(index);
    this.repo.save(index);
    this.indexed = true;
    this.currentHash = index.sourceHistoryHash;
    this.builtAt = index.builtAt;
    this.documentCount = index.documentCount;
  }

  search(query: HistorySearchQuery): HistorySearchResult[] {
    if (!this.indexed) return [];
    return this.strategy.search(query);
  }

  clearIndex(): void {
    this.strategy.clear();
    this.repo.clear();
    this.indexed = false;
    this.currentHash = null;
    this.builtAt = undefined;
    this.documentCount = 0;
  }

  getIndexStatus(): HistoryIndexStatus {
    return {
      indexed: this.indexed,
      documentCount: this.documentCount,
      builtAt: this.builtAt,
      stale: false,
    };
  }
}
