import type { HistorySearchStrategy } from '../HistorySearchStrategy';
import type {
  HistorySearchQuery,
  HistorySearchResult,
  SerializedHistorySearchIndex,
} from '../types';
import { tokenize } from './Bm25Tokenizer';
import type { Bm25Config } from './Bm25Types';
import { DEFAULT_BM25_CONFIG } from './Bm25Types';
import { InMemoryBm25Engine } from './InMemoryBm25Engine';

export class Bm25HistorySearchStrategy implements HistorySearchStrategy {
  constructor(
    private readonly engine: InMemoryBm25Engine,
    private readonly cfg: Bm25Config = DEFAULT_BM25_CONFIG,
  ) {}

  search(query: HistorySearchQuery): HistorySearchResult[] {
    const queryTokens = tokenize(query.text, this.cfg.minTokenLength);
    if (queryTokens.length === 0) return [];

    let ranked = this.engine.rankAll(queryTokens);

    // Filter: exclude current conversation unless explicitly included
    if (query.conversationId && !query.includeCurrentConversation) {
      ranked = ranked.filter(r => r.doc.conversationId !== query.conversationId);
    }

    // Filter: role
    if (query.roles && query.roles.length > 0) {
      ranked = ranked.filter(r => query.roles!.includes(r.doc.role));
    }

    // Filter: mode
    if (query.modes && query.modes.length > 0) {
      ranked = ranked.filter(r =>
        r.doc.mode ? query.modes!.includes(r.doc.mode) : false,
      );
    }

    // Filter: time range
    if (query.from != null) {
      ranked = ranked.filter(r => r.doc.timestamp >= query.from!);
    }
    if (query.to != null) {
      ranked = ranked.filter(r => r.doc.timestamp <= query.to!);
    }

    const limit = query.limit ?? this.cfg.maxResults;

    return ranked.slice(0, limit).map(r => ({
      document: r.doc,
      score: r.score,
      matchedTerms: queryTokens.filter(t => r.doc.tokens.includes(t)),
      highlights: this.extractHighlights(r.doc.content, queryTokens),
    }));
  }

  loadIndex(index: SerializedHistorySearchIndex): void {
    this.engine.load(index);
  }

  clear(): void {
    this.engine.clear();
  }

  /**
   * Extract up to 3 sentence/line snippets that contain query terms.
   */
  private extractHighlights(content: string, queryTokens: string[]): string[] {
    // Split into candidate sentences
    const sentences = content
      .split(/(?<=[.!?])\s+|[\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    const tokenSet = new Set(queryTokens);
    const snippets: string[] = [];

    for (const sentence of sentences) {
      if (snippets.length >= 3) break;
      const lower = sentence.toLowerCase();
      const hasMatch = queryTokens.some(t => lower.includes(t));
      if (hasMatch) {
        snippets.push(sentence.slice(0, 200));
      }
    }

    // If no sentence-level matches, fall back to first 200 chars
    if (snippets.length === 0 && content.length > 0) {
      snippets.push(content.slice(0, 200));
    }

    // Suppress unused variable warning
    void tokenSet;

    return snippets;
  }
}
