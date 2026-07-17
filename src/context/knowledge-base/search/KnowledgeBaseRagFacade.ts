import { tokenize } from '../../history-search/bm25/Bm25Tokenizer';
import { bm25Score } from '../../history-search/bm25/Bm25Scorer';
import { DEFAULT_BM25_CONFIG } from '../../history-search/bm25/Bm25Types';
import type { KnowledgeBaseEntry } from '../types';
import { KnowledgeBaseIndexBuilder } from './KnowledgeBaseIndexBuilder';
import type { KnowledgeBaseSearchResult } from './KnowledgeBaseDocument';

export interface KnowledgeBaseRagOptions {
  maxResults?: number;
  maxChars?: number;
  minScore?: number;
}

const MAX_PROMPT_EXCERPT = 150;

export class KnowledgeBaseRagFacade {
  constructor(
    private readonly indexBuilder: KnowledgeBaseIndexBuilder = new KnowledgeBaseIndexBuilder(),
  ) {}

  build(entries: KnowledgeBaseEntry[], query: string, opts: KnowledgeBaseRagOptions = {}): string {
    const { maxResults = 5, maxChars = 3000, minScore = 1.0 } = opts;

    const index = this.indexBuilder.build(entries);
    if (index.documents.length === 0) return '';

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return '';

    const results = this.search(queryTokens, index.documents, index.stats, maxResults, minScore);
    if (results.length === 0) return '';

    return this.formatContext(results, entries, maxChars);
  }

  private search(
    queryTokens: string[],
    documents: ReturnType<KnowledgeBaseIndexBuilder['build']>['documents'],
    stats: ReturnType<KnowledgeBaseIndexBuilder['build']>['stats'],
    maxResults: number,
    minScore: number,
  ): KnowledgeBaseSearchResult[] {
    const scored: KnowledgeBaseSearchResult[] = [];

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

  private formatContext(
    results: KnowledgeBaseSearchResult[],
    entries: KnowledgeBaseEntry[],
    maxChars: number,
  ): string {
    const lines: string[] = [];
    lines.push(`## Project Knowledge Base (${results.length} prior task(s))`);
    lines.push('');

    for (const { document } of results) {
      const entry = entries[document.entryIndex];
      if (!entry) continue;

      const date = new Date(entry.createdAt).toISOString().slice(0, 10);
      const excerpt = entry.originalPrompt.slice(0, MAX_PROMPT_EXCERPT).replace(/\s+/g, ' ').trim();
      lines.push(`[${date} · ${entry.mode} · ${entry.status}] ${excerpt}`);

      if (entry.implementationSummary) {
        lines.push(`  Summary: ${entry.implementationSummary}`);
      }
      if (entry.changedFiles.length > 0) {
        lines.push(`  Changed: ${entry.changedFiles.map(f => f.path).join(', ')}`);
      }
      if (entry.warnings && entry.warnings.length > 0) {
        lines.push(`  Warnings: ${entry.warnings.join('; ')}`);
      }
    }

    const result = lines.join('\n');
    return result.length > maxChars ? result.slice(0, maxChars) : result;
  }
}
