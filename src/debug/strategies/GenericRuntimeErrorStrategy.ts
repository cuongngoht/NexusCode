import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

// Generic file reference: matches paths ending in common source extensions
const GENERIC_FILE_REF_RE =
  /[\w./\-]+\.(py|rb|go|rs|java|kt|cs|php|swift|cpp|cc|cxx|c|sh|bash)(?=[\s:,)"\]']|$)/gi;

export class GenericRuntimeErrorStrategy implements DebugSearchStrategy {
  readonly name = 'generic-runtime-error';

  canHandle(ctx: DebugChainContext): boolean {
    // Activate only when no more specific strategy has already handled this
    // and there are files or some signal
    if (!ctx.signal) return false;
    // Skip if signal already matched a specific language strategy
    const raw = ctx.signal.raw;
    const hasKnownSignal =
      /Traceback \(most recent call last\):|error\[E\d{4}\]|goroutine \d+ \[|Exception in thread|CS\d{4}|\.rb:\d+:in `/.test(raw);
    if (hasKnownSignal) return false;
    // Only activate when there are recognizable source file references
    return GENERIC_FILE_REF_RE.test(raw);
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const raw = ctx.signal?.raw ?? '';
    const results: DebugSearchResult[] = [];
    const seenPaths = new Set<string>();

    let m: RegExpExecArray | null;
    GENERIC_FILE_REF_RE.lastIndex = 0;
    while ((m = GENERIC_FILE_REF_RE.exec(raw)) !== null) {
      const filePath = m[0].replace(/\\/g, '/');
      if (seenPaths.has(filePath)) continue;
      seenPaths.add(filePath);
      results.push({
        path: filePath,
        score: 150,
        reason: 'Generic runtime error file reference',
      });
    }

    return results;
  }
}
