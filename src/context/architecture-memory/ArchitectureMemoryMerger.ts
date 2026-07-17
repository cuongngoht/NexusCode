import type { ArchitectureMemory, ArchitectureModule } from './types';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export class ArchitectureMemoryMerger {
  /**
   * Merges freshly re-detected modules into a baseline's module list.
   *
   * Returns `undefined` when there's no baseline to merge into — callers must fall back to a
   * full rebuild rather than silently producing a partial memory.
   *
   * Modules whose path is neither in `changedModules` nor `deletedOrRenamedOldPaths` pass
   * through completely untouched (same `sourceEvidence`/`patterns`/`imports` object as the
   * baseline) — only the touched set is ever re-detected or re-derived.
   */
  merge(
    baseline: ArchitectureMemory | undefined,
    changedModules: ArchitectureModule[],
    deletedOrRenamedOldPaths: string[],
  ): ArchitectureModule[] | undefined {
    if (!baseline) return undefined;

    const changedByPath = new Map(changedModules.map(m => [normalizePath(m.path), m]));
    const dropSet = new Set(deletedOrRenamedOldPaths.map(normalizePath));

    const untouched = baseline.modules.filter(m => {
      const path = normalizePath(m.path);
      return !dropSet.has(path) && !changedByPath.has(path);
    });

    return [...untouched, ...changedByPath.values()];
  }
}
