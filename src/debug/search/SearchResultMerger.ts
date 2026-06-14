import type { DebugSearchResult } from './DebugSearchResult';

/**
 * Merge multiple DebugSearchResult arrays, keeping the highest score per path.
 * Optional score boosts can be applied per result during merge.
 */
export function mergeSearchResults(
  ...resultSets: DebugSearchResult[][]
): DebugSearchResult[] {
  const combined = new Map<string, DebugSearchResult>();

  for (const results of resultSets) {
    for (const r of results) {
      const existing = combined.get(r.path);
      if (!existing || r.score > existing.score) {
        combined.set(r.path, r);
      }
    }
  }

  const merged = [...combined.values()];
  merged.sort((a, b) => b.score - a.score);
  return merged;
}

/**
 * Apply a score boost to results whose paths appear in a boost set.
 */
export function applyBoosts(
  results: DebugSearchResult[],
  boosts: Map<string, number>,
): DebugSearchResult[] {
  return results.map(r => {
    const boost = boosts.get(r.path) ?? 0;
    if (boost === 0) return r;
    return { ...r, score: r.score + boost };
  });
}

/**
 * Deduplicate a list of file paths while preserving insertion order.
 */
export function deduplicatePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths.filter(p => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}
