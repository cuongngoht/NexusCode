import type { SearchDocument, SerializedHistorySearchIndex } from '../types';
import { bm25Score } from './Bm25Scorer';
import { DEFAULT_BM25_CONFIG, type Bm25Config } from './Bm25Types';

interface CorpusStats {
  avgDocLength: number;
  docFreq: Record<string, number>;
  totalDocs: number;
}

export class InMemoryBm25Engine {
  private documents: SearchDocument[] = [];
  private stats: CorpusStats = {
    avgDocLength: 0,
    docFreq: {},
    totalDocs: 0,
  };

  constructor(private readonly cfg: Bm25Config = DEFAULT_BM25_CONFIG) {}

  load(index: SerializedHistorySearchIndex): void {
    this.documents = index.documents;
    this.stats = index.stats;
  }

  /**
   * Score a single document against query tokens by summing BM25 scores
   * over all matched terms.
   */
  score(queryTokens: string[], doc: SearchDocument): number {
    let total = 0;

    // Build term-frequency map for this document
    const tf: Record<string, number> = {};
    for (const t of doc.tokens) {
      tf[t] = (tf[t] ?? 0) + 1;
    }

    const docLength = doc.tokens.length;

    for (const token of queryTokens) {
      const termFreq = tf[token] ?? 0;
      if (termFreq === 0) continue;

      const df = this.stats.docFreq[token] ?? 0;
      total += bm25Score(
        termFreq,
        docLength,
        this.stats.avgDocLength,
        df,
        this.stats.totalDocs,
        this.cfg,
      );
    }

    return total;
  }

  /**
   * Score all documents, filter out zero-score docs, sort descending,
   * and return up to maxResults.
   */
  rankAll(queryTokens: string[]): Array<{ doc: SearchDocument; score: number }> {
    const scored = this.documents
      .map(doc => ({ doc, score: this.score(queryTokens, doc) }))
      .filter(r => r.score > 0);

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, this.cfg.maxResults);
  }

  clear(): void {
    this.documents = [];
    this.stats = { avgDocLength: 0, docFreq: {}, totalDocs: 0 };
  }
}
