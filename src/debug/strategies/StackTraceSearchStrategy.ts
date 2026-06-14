import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

export class StackTraceSearchStrategy implements DebugSearchStrategy {
  readonly name = 'stack-trace';

  canHandle(ctx: DebugChainContext): boolean {
    return (
      ctx.signal?.kind === 'stack-trace' ||
      ctx.signal?.kind === 'terminal-output' ||
      (ctx.signal?.files.length ?? 0) > 0
    );
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    if (!ctx.signal) return [];

    return ctx.signal.files.map(ref => ({
      path: ref.path,
      score: 200,
      reason: 'Referenced by stack trace',
      matchedTerms: [ref.path],
      snippet: ref.line ? `Line ${ref.line}${ref.column ? `:${ref.column}` : ''}` : undefined,
    }));
  }
}
