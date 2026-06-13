import type { DebugSearchAdapter } from './DebugSearchAdapter';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';
import { Bm25Index } from '../search/Bm25Index';
import { buildDebugQueries } from '../search/DebugQueryBuilder';

/**
 * Internal workspace search adapter backed by BM25.
 * Always available — requires no external tools.
 */
export class InternalWorkspaceSearchAdapter implements DebugSearchAdapter {
  readonly name = 'internal-bm25';

  isAvailable(): boolean {
    return true;
  }

  async search(query: string, ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const index = await Bm25Index.build(ctx.workspaceRoot, {
      excludeDirs: ctx.projectExcludeFromIndex,
      maxFileBytes: ctx.maxFileBytes,
    });
    const queries = ctx.signal
      ? buildDebugQueries(ctx.signal, ctx.originalPrompt)
      : [query];
    return index.searchMany(queries, ctx.maxBm25Results);
  }
}
