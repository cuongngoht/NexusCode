import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

export interface DebugSearchStrategy {
  readonly name: string;
  canHandle(ctx: DebugChainContext): boolean;
  search(ctx: DebugChainContext): Promise<DebugSearchResult[]>;
}
