import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

/**
 * Base interface for debug search adapters.
 * Adapters bridge different search backends (internal BM25, CLI search, provider search).
 */
export interface DebugSearchAdapter {
  readonly name: string;
  isAvailable(): boolean;
  search(query: string, ctx: DebugChainContext): Promise<DebugSearchResult[]>;
}
