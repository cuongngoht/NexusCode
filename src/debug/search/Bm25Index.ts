// TODO: cache incremental index by file path + mtime + size.
import * as fs from 'fs';
import { tokenize, tokenizePath } from './Bm25Tokenizer';
import { collectWorkspaceFiles } from './WorkspaceFileCollector';
import type { DebugSearchResult } from './DebugSearchResult';

export interface Bm25BuildOptions {
  excludeDirs?: string[];
  maxFileBytes?: number;
}

interface DocumentEntry {
  relativePath: string;
  termFreq: Map<string, number>;
  docLength: number;
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;

export class Bm25Index {
  private readonly docs: DocumentEntry[];
  private readonly idf: Map<string, number>;
  private readonly avgDocLength: number;

  private constructor(docs: DocumentEntry[], idf: Map<string, number>, avgDocLength: number) {
    this.docs = docs;
    this.idf = idf;
    this.avgDocLength = avgDocLength;
  }

  static async build(workspaceRoot: string, options: Bm25BuildOptions = {}): Promise<Bm25Index> {
    const files = collectWorkspaceFiles(workspaceRoot, {
      extraExcludeDirs: options.excludeDirs,
      maxFileBytes: options.maxFileBytes,
    });

    const docs: DocumentEntry[] = [];
    const docFreq = new Map<string, number>();

    for (const file of files) {
      let content = '';
      try {
        content = fs.readFileSync(file.absolutePath, 'utf8');
      } catch {
        continue;
      }

      // Combine path tokens + content tokens
      const pathTokens = tokenizePath(file.relativePath);
      const contentTokens = tokenize(content);
      const allTokens = [...pathTokens, ...contentTokens];

      const termFreq = new Map<string, number>();
      for (const token of allTokens) {
        termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
      }

      docs.push({
        relativePath: file.relativePath,
        termFreq,
        docLength: allTokens.length,
      });

      for (const term of termFreq.keys()) {
        docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
      }
    }

    const N = docs.length;
    const avgDocLength = N === 0 ? 1 : docs.reduce((s, d) => s + d.docLength, 0) / N;

    const idf = new Map<string, number>();
    for (const [term, df] of docFreq) {
      idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
    }

    return new Bm25Index(docs, idf, avgDocLength);
  }

  search(query: string, limit: number): DebugSearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores: Array<{ path: string; score: number; matchedTerms: string[] }> = [];

    for (const doc of this.docs) {
      let score = 0;
      const matchedTerms: string[] = [];

      for (const term of queryTokens) {
        const tf = doc.termFreq.get(term) ?? 0;
        if (tf === 0) continue;
        const idfVal = this.idf.get(term) ?? 0;
        const tfNorm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * doc.docLength / this.avgDocLength));
        score += idfVal * tfNorm;
        matchedTerms.push(term);
      }

      if (score > 0) {
        scores.push({ path: doc.relativePath, score, matchedTerms });
      }
    }

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, limit).map(s => ({
      path: s.path,
      score: s.score,
      matchedTerms: s.matchedTerms,
      reason: `BM25 score: ${s.score.toFixed(2)}, matched: ${s.matchedTerms.slice(0, 5).join(', ')}`,
    }));
  }

  searchMany(queries: string[], limit: number): DebugSearchResult[] {
    if (queries.length === 0) return [];

    const combined = new Map<string, DebugSearchResult>();

    for (const query of queries) {
      const results = this.search(query, limit * 2);
      for (const r of results) {
        const existing = combined.get(r.path);
        if (!existing || r.score > existing.score) {
          combined.set(r.path, r);
        }
      }
    }

    const merged = [...combined.values()];
    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, limit);
  }

  get documentCount(): number {
    return this.docs.length;
  }

  getPathAt(index: number): string | undefined {
    return this.docs[index]?.relativePath;
  }
}
