import { tokenize } from '../../history-search/bm25/Bm25Tokenizer';
import { bm25Score } from '../../history-search/bm25/Bm25Scorer';
import { DEFAULT_BM25_CONFIG } from '../../history-search/bm25/Bm25Types';
import type { KnowledgeFact } from '../types';
import { FactsIndexBuilder, isRetrievable } from './FactsIndexBuilder';
import type { FactsSearchResult } from './FactsDocument';

export interface FactsRagOptions {
  maxResults?: number;
  maxChars?: number;
  minScore?: number;
}

export class FactsRagFacade {
  constructor(
    private readonly indexBuilder: FactsIndexBuilder = new FactsIndexBuilder(),
  ) {}

  build(facts: KnowledgeFact[], query: string, opts: FactsRagOptions = {}): string {
    const { maxResults = 5, maxChars = 3000, minScore = 1.0 } = opts;

    // Filtering twice (here and inside indexBuilder.build) on the same input is safe: isRetrievable
    // is pure/deterministic, so both filtered arrays are identical and in the same order — the
    // index's factIndex values correctly address into this array.
    const retrievable = facts.filter(isRetrievable);
    const index = this.indexBuilder.build(facts);
    if (index.documents.length === 0) return '';

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return '';

    const results = this.search(queryTokens, index.documents, index.stats, maxResults, minScore);
    if (results.length === 0) return '';

    return this.formatContext(results, retrievable, maxChars);
  }

  private search(
    queryTokens: string[],
    documents: ReturnType<FactsIndexBuilder['build']>['documents'],
    stats: ReturnType<FactsIndexBuilder['build']>['stats'],
    maxResults: number,
    minScore: number,
  ): FactsSearchResult[] {
    const scored: FactsSearchResult[] = [];

    for (const doc of documents) {
      const tf: Record<string, number> = {};
      for (const t of doc.tokens) {
        tf[t] = (tf[t] ?? 0) + 1;
      }

      let total = 0;
      for (const token of queryTokens) {
        const termFreq = tf[token] ?? 0;
        if (termFreq === 0) continue;
        total += bm25Score(
          termFreq,
          doc.tokens.length,
          stats.avgDocLength,
          stats.docFreq[token] ?? 0,
          stats.totalDocs,
          DEFAULT_BM25_CONFIG,
        );
      }

      if (total >= minScore) {
        scored.push({ document: doc, score: total });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults);
  }

  private formatContext(results: FactsSearchResult[], facts: KnowledgeFact[], maxChars: number): string {
    const lines: string[] = [];
    lines.push(`## Knowledge Facts (${results.length} retrieved)`);
    lines.push('');

    for (const { document } of results) {
      const fact = facts[document.factIndex];
      if (!fact) continue;

      const label = fact.status === 'candidate'
        ? ` (not yet confirmed — candidate, confidence ${Math.round(fact.confidence * 100)}%)`
        : '';
      lines.push(`[${fact.kind}] ${fact.subject}: ${fact.statement}${label}`);
    }

    const result = lines.join('\n');
    return result.length > maxChars ? result.slice(0, maxChars) : result;
  }
}
