import type { CollectedFile } from './WorkspaceFileCollector';

export interface CachedBm25Document {
  mtimeMs: number;
  sizeBytes: number;
  termFreq: Map<string, number>;
  docLength: number;
}

/**
 * In-memory per-session cache of tokenized documents, keyed by absolute path
 * and validated by (mtimeMs, sizeBytes). Only per-document tokenization is
 * cached — IDF and avgDocLength are corpus-global and recomputed each build.
 * Not persisted: tokenization dominates build cost, and an extension-host
 * session cache already covers repeated debug runs.
 * Same-second saves with unchanged size can miss an edit on filesystems with
 * coarse mtime resolution — acceptable for a debug-search heuristic.
 */
export class Bm25DocumentCache {
  private readonly byAbsPath = new Map<string, CachedBm25Document>();

  get(file: CollectedFile): CachedBm25Document | undefined {
    const cached = this.byAbsPath.get(file.absolutePath);
    if (!cached) return undefined;
    if (cached.mtimeMs !== file.mtimeMs || cached.sizeBytes !== file.sizeBytes) {
      return undefined;
    }
    return cached;
  }

  set(file: CollectedFile, doc: CachedBm25Document): void {
    this.byAbsPath.set(file.absolutePath, doc);
  }

  prune(liveAbsPaths: ReadonlySet<string>): void {
    for (const key of this.byAbsPath.keys()) {
      if (!liveAbsPaths.has(key)) {
        this.byAbsPath.delete(key);
      }
    }
  }

  get size(): number {
    return this.byAbsPath.size;
  }
}

const cachesByRoot = new Map<string, Bm25DocumentCache>();

export function getBm25CacheFor(workspaceRoot: string): Bm25DocumentCache {
  let cache = cachesByRoot.get(workspaceRoot);
  if (!cache) {
    cache = new Bm25DocumentCache();
    cachesByRoot.set(workspaceRoot, cache);
  }
  return cache;
}
