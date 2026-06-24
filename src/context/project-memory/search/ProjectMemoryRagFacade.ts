import { tokenize } from '../../history-search/bm25/Bm25Tokenizer';
import { bm25Score } from '../../history-search/bm25/Bm25Scorer';
import { DEFAULT_BM25_CONFIG } from '../../history-search/bm25/Bm25Types';
import type { PipelineProjectMemoryStatus } from '../../../core/pipeline/PipelineContext';
import type { FsProjectMemoryIndexRepository } from './ProjectMemoryIndexRepository';
import type { ProjectMemoryDocument, ProjectMemorySearchResult } from './ProjectMemoryDocument';

export interface ProjectMemoryRagOptions {
  maxResults: number;
  maxChars: number;
  minScore: number;
}

export class ProjectMemoryRagFacade {
  constructor(private readonly repo: FsProjectMemoryIndexRepository) {}

  async buildRagForPrompt(
    prompt: string,
    workspaceRoot: string,
    status: PipelineProjectMemoryStatus,
    opts: ProjectMemoryRagOptions,
  ): Promise<{ ragContext: string | null; resultCount: number }> {
    if (!status.canUseMemory) return { ragContext: null, resultCount: 0 };

    const index = await this.repo.load(workspaceRoot);
    if (!index || index.documents.length === 0) return { ragContext: null, resultCount: 0 };

    const queryTokens = tokenize(prompt);
    if (queryTokens.length === 0) return { ragContext: null, resultCount: 0 };

    const results = this.search(queryTokens, index.documents, index.stats, opts.maxResults);
    const passing = results.filter(r => r.score >= opts.minScore);
    if (passing.length === 0) return { ragContext: null, resultCount: 0 };

    let validated = passing;
    try { validated = await this.filterDeadChunks(passing); } catch { /* non-blocking */ }
    if (validated.length === 0) return { ragContext: null, resultCount: 0 };

    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const staleness = {
      isStatusStale: status.status === 'stale',
      isAncient: (Date.now() - index.builtAt) > SEVEN_DAYS,
    };

    const ragContext = this.buildContext(validated, opts.maxChars, staleness);
    return { ragContext, resultCount: validated.length };
  }

  private search(
    queryTokens: string[],
    documents: ProjectMemoryDocument[],
    stats: { avgDocLength: number; docFreq: Record<string, number>; totalDocs: number },
    limit: number,
  ): ProjectMemorySearchResult[] {
    const scored: ProjectMemorySearchResult[] = [];

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

      if (total > 0) {
        scored.push({ document: doc, score: total });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  private buildContext(
    results: ProjectMemorySearchResult[],
    maxChars: number,
    staleness: { isStatusStale: boolean; isAncient: boolean },
  ): string {
    const lines: string[] = ['<project_memory>'];

    if (staleness.isStatusStale) {
      lines.push(
        '<staleness_warning>Project memory was built before recent code changes. ' +
        'Treat file paths, module names, and APIs as possibly stale — verify against actual files before acting.</staleness_warning>',
      );
    } else if (staleness.isAncient) {
      lines.push(
        '<staleness_warning>Project memory index is over 7 days old. ' +
        'Some details may no longer reflect the current codebase.</staleness_warning>',
      );
    }

    let remaining = maxChars;
    for (let i = 0; i < results.length; i++) {
      const { document: doc } = results[i];
      const excerpt = doc.content.slice(0, Math.min(remaining, 800));
      if (!excerpt) break;

      lines.push(`[${i + 1}] Section: ${doc.section} (${doc.source})`);
      lines.push(`Content: ${excerpt}`);
      lines.push('');

      remaining -= excerpt.length;
      if (remaining <= 0) break;
    }

    lines.push('</project_memory>');
    return lines.join('\n');
  }

  private async filterDeadChunks(results: ProjectMemorySearchResult[]): Promise<ProjectMemorySearchResult[]> {
    const { access } = await import('fs/promises');
    const live: ProjectMemorySearchResult[] = [];
    for (const r of results) {
      const paths = r.document.sourcePaths;
      if (!paths?.length) { live.push(r); continue; }
      let kept = false;
      for (const p of paths) {
        try { await access(p); kept = true; break; } catch { /* path missing, try next */ }
      }
      if (kept) live.push(r);
    }
    return live;
  }
}
