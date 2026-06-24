import { tokenize } from '../history-search/bm25/Bm25Tokenizer';
import { bm25Score } from '../history-search/bm25/Bm25Scorer';
import { DEFAULT_BM25_CONFIG } from '../history-search/bm25/Bm25Types';
import type { IFileIntelligenceStore } from './FileIntelligenceStore';
import type { FileIntelligenceProfile } from './types';

interface ProfileDoc {
  filePath: string;
  tokens: string[];
}

export class FileIntelligenceRagFacade {
  constructor(private readonly store: IFileIntelligenceStore) {}

  async search(
    prompt: string,
    workspaceRoot: string,
    opts: { maxResults?: number; minScore?: number } = {},
  ): Promise<FileIntelligenceProfile[]> {
    const { maxResults = 8, minScore = 0.05 } = opts;

    const queryTokens = tokenize(prompt);
    if (queryTokens.length === 0) return [];

    const index = await this.store.readIndex(workspaceRoot).catch(() => undefined);
    if (!index || index.profiles.length === 0) return [];

    // Load all profiles in parallel
    const loaded = await Promise.all(
      index.profiles.map(e => this.store.read(workspaceRoot, e.filePath).catch(() => undefined)),
    );
    const profiles = loaded.filter((p): p is FileIntelligenceProfile => p !== undefined);
    if (profiles.length === 0) return [];

    // Build document corpus
    const docs: ProfileDoc[] = profiles.map(p => ({
      filePath: p.filePath,
      tokens: tokenize(this.toText(p)),
    }));

    // Corpus stats
    const totalDocs = docs.length;
    const avgDocLength = docs.reduce((s, d) => s + d.tokens.length, 0) / totalDocs;
    const docFreq: Record<string, number> = {};
    for (const doc of docs) {
      for (const t of new Set(doc.tokens)) {
        docFreq[t] = (docFreq[t] ?? 0) + 1;
      }
    }

    // Score each doc
    const scored: Array<{ profile: FileIntelligenceProfile; score: number }> = [];
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const tf: Record<string, number> = {};
      for (const t of doc.tokens) tf[t] = (tf[t] ?? 0) + 1;

      let score = 0;
      for (const qt of queryTokens) {
        const termFreq = tf[qt] ?? 0;
        if (termFreq === 0) continue;
        score += bm25Score(termFreq, doc.tokens.length, avgDocLength, docFreq[qt] ?? 1, totalDocs, DEFAULT_BM25_CONFIG);
      }
      if (score >= minScore) {
        scored.push({ profile: profiles[i], score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map(s => s.profile);
  }

  private toText(p: FileIntelligenceProfile): string {
    const parts: string[] = [p.filePath];
    if (p.summary) parts.push(p.summary);
    if (p.responsibilities) parts.push(...p.responsibilities);
    if (p.knownRisks) parts.push(...p.knownRisks);
    if (p.debugFindings) parts.push(...p.debugFindings.map(f => f.description));
    if (p.reviewFindings) parts.push(...p.reviewFindings.map(f => f.message));
    if (p.changeHistory) parts.push(...p.changeHistory.slice(0, 3).map(h => h.reason ?? ''));
    return parts.filter(Boolean).join(' ');
  }
}
