import { tokenize } from '../../history-search/bm25/Bm25Tokenizer';
import { bm25Score } from '../../history-search/bm25/Bm25Scorer';
import { DEFAULT_BM25_CONFIG } from '../../history-search/bm25/Bm25Types';
import type { ArchitectureLayer, ArchitectureMemory } from '../types';
import { ArchitectureIndexBuilder } from './ArchitectureIndexBuilder';
import type { ArchitectureSearchResult } from './ArchitectureDocument';

export interface ArchitectureRagOptions {
  maxResults?: number;
  maxChars?: number;
  minScore?: number;
}

const MAX_VIOLATION_EXCERPT = 120;

export class ArchitectureRagFacade {
  constructor(
    private readonly indexBuilder: ArchitectureIndexBuilder = new ArchitectureIndexBuilder(),
  ) {}

  build(memory: ArchitectureMemory, prompt: string, opts: ArchitectureRagOptions = {}): string {
    const { maxResults = 6, maxChars = 3000, minScore = 1.0 } = opts;

    const index = this.indexBuilder.build(memory);
    if (index.documents.length === 0) return '';

    const queryTokens = tokenize(prompt);
    if (queryTokens.length === 0) return '';

    const results = this.search(queryTokens, index, maxResults, minScore);
    if (results.length === 0) return '';

    return this.formatContext(results, memory, maxChars);
  }

  private search(
    queryTokens: string[],
    index: ReturnType<ArchitectureIndexBuilder['build']>,
    maxResults: number,
    minScore: number,
  ): ArchitectureSearchResult[] {
    const scored: ArchitectureSearchResult[] = [];

    for (const doc of index.documents) {
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
          index.stats.avgDocLength,
          index.stats.docFreq[token] ?? 0,
          index.stats.totalDocs,
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
    results: ArchitectureSearchResult[],
    memory: ArchitectureMemory,
    maxChars: number,
  ): string {
    const lines: string[] = [];

    const styleLabel = memory.detectedStyle.replace(/-/g, ' ');
    const configNote = memory.configSource === 'user-config' ? 'user config' : 'heuristic';
    lines.push(`## Architecture Context (${styleLabel} — ${configNote})`);

    const layerParts = (Object.entries(memory.layerSummary) as [ArchitectureLayer, number][])
      .filter(([, n]) => n > 0)
      .map(([l, n]) => `${l} (${n})`);
    if (layerParts.length > 0) {
      lines.push(`Layers: ${layerParts.join(', ')}`);
    }
    lines.push('');

    const moduleMap = new Map(memory.modules.map(m => [`module::${m.path}`, m]));
    const violationMap = new Map(memory.violations.map(v => [`violation::${v.id}`, v]));

    for (const { document: doc } of results) {
      if (doc.source === 'module') {
        const m = moduleMap.get(doc.id);
        if (!m) continue;
        const patternSuffix = m.patterns.length > 0 ? ` | patterns: ${m.patterns.join(', ')}` : '';
        lines.push(`[module] ${m.path} — layer: ${m.layer}${patternSuffix}`);
      } else if (doc.source === 'violation') {
        const v = violationMap.get(doc.id);
        if (!v) continue;
        const excerpt = v.rule.slice(0, MAX_VIOLATION_EXCERPT);
        lines.push(`[${v.severity.toUpperCase()}] ${v.fromLayer} → ${v.toLayer}: ${v.from} → ${v.to}`);
        lines.push(`  ${excerpt}`);
      } else if (doc.source === 'layer') {
        lines.push(`[layer] ${doc.section}`);
      } else if (doc.source === 'rule') {
        lines.push(`[rule] ${doc.section}`);
      }
    }

    const result = lines.join('\n');
    return result.length > maxChars ? result.slice(0, maxChars) : result;
  }
}
