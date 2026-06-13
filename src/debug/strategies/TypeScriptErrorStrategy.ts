import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

export class TypeScriptErrorStrategy implements DebugSearchStrategy {
  readonly name = 'typescript-error';

  canHandle(ctx: DebugChainContext): boolean {
    return (
      ctx.signal?.kind === 'type-error' ||
      ctx.suspectedTools.includes('typescript')
    );
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];

    // Explicit TS error file references
    if (ctx.signal) {
      for (const ref of ctx.signal.files) {
        results.push({
          path: ref.path,
          score: 200,
          reason: 'TypeScript error source file',
        });
      }
    }

    // tsconfig.json
    const tsconfigPath = 'tsconfig.json';
    if (fs.existsSync(path.join(ctx.workspaceRoot, tsconfigPath))) {
      results.push({
        path: tsconfigPath,
        score: 80,
        reason: 'TypeScript configuration',
      });
    }

    // Also look for tsconfig.*.json
    try {
      const entries = fs.readdirSync(ctx.workspaceRoot);
      for (const entry of entries) {
        if (/^tsconfig\..+\.json$/.test(entry)) {
          results.push({
            path: entry,
            score: 60,
            reason: 'TypeScript configuration variant',
          });
        }
      }
    } catch {
      // non-fatal
    }

    return results;
  }
}
