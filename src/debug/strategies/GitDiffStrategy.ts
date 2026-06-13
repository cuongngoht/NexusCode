import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

export class GitDiffStrategy implements DebugSearchStrategy {
  readonly name = 'git-diff';

  canHandle(ctx: DebugChainContext): boolean {
    return ctx.gitChangedFiles.length > 0;
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    return ctx.gitChangedFiles.map(filePath => ({
      path: filePath,
      score: 60,
      reason: 'Recently changed in git working tree',
    }));
  }
}
