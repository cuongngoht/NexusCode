import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';
import { Bm25Index } from '../search/Bm25Index';
import { buildDebugQueries } from '../search/DebugQueryBuilder';
import { mergeSearchResults, deduplicatePaths } from '../search/SearchResultMerger';
import type { DebugSearchResult } from '../search/DebugSearchResult';
import * as path from 'path';

const BOOST_EXPLICIT_STACK_FILE = 100;
const BOOST_TS_ERROR_FILE = 100;
const BOOST_GIT_CHANGED = 20;
const BOOST_TEST_SOURCE_RELATED = 15;
const BOOST_CONFIG_SUSPECTED_TOOL = 10;

function isTestOrSourceRelated(filePath: string): boolean {
  return /\.test\.|\.spec\.|__tests__/.test(filePath);
}

function isConfigForSuspectedTool(filePath: string, suspectedTools: string[]): boolean {
  const base = path.basename(filePath).toLowerCase();
  if (suspectedTools.includes('typescript') && base.startsWith('tsconfig')) return true;
  if (suspectedTools.includes('vite') && base.startsWith('vite.config')) return true;
  if (suspectedTools.includes('vitest') && (base.startsWith('vitest.config') || base.includes('vitest'))) return true;
  if (suspectedTools.includes('jest') && (base.startsWith('jest.config') || base === 'jest.setup.ts' || base === 'jest.setup.js')) return true;
  if (suspectedTools.includes('eslint') && (base.startsWith('.eslint') || base.startsWith('eslint.config'))) return true;
  return false;
}

export class Bm25RetrievalStep extends BaseDebugStep {
  readonly name = 'debug-bm25-retrieval';
  protected readonly state: DebugState = 'retrieving_context';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    if (ctx.bm25Enabled === false) {
      return { status: 'continue' };
    }
    if (!ctx.signal) {
      return { status: 'continue' };
    }

    // Build BM25 index
    const index = await Bm25Index.build(ctx.workspaceRoot, {
      excludeDirs: ctx.projectExcludeFromIndex,
      maxFileBytes: ctx.maxFileBytes,
    });

    // Build queries from the debug signal
    const queries = buildDebugQueries(ctx.signal, ctx.originalPrompt);

    // Search
    const rawResults = index.searchMany(queries, ctx.maxBm25Results * 2);

    // Build boost map
    const boosts = new Map<string, number>();

    // Explicit stack/TS error files get highest boost
    for (const ref of ctx.signal.files) {
      const existing = boosts.get(ref.path) ?? 0;
      boosts.set(ref.path, existing + BOOST_EXPLICIT_STACK_FILE);
    }

    // Git changed files get a moderate boost
    for (const f of ctx.gitChangedFiles) {
      const existing = boosts.get(f) ?? 0;
      boosts.set(f, existing + BOOST_GIT_CHANGED);
    }

    // Additional boosts based on file characteristics
    for (const r of rawResults) {
      if (isTestOrSourceRelated(r.path)) {
        const existing = boosts.get(r.path) ?? 0;
        boosts.set(r.path, existing + BOOST_TEST_SOURCE_RELATED);
      }
      if (isConfigForSuspectedTool(r.path, ctx.suspectedTools)) {
        const existing = boosts.get(r.path) ?? 0;
        boosts.set(r.path, existing + BOOST_CONFIG_SUSPECTED_TOOL);
      }
    }

    // Also create synthetic results for explicit stack files not found by BM25
    const explicitResults: DebugSearchResult[] = ctx.signal.files.map(ref => ({
      path: ref.path,
      score: BOOST_TS_ERROR_FILE,
      reason: `Explicit ${ctx.signal?.kind === 'type-error' ? 'TypeScript error' : 'stack trace'} file reference`,
    }));

    // Apply boosts and merge
    const boosted = rawResults.map(r => ({
      ...r,
      score: r.score + (boosts.get(r.path) ?? 0),
    }));

    const merged = mergeSearchResults(boosted, explicitResults);
    merged.sort((a, b) => b.score - a.score);

    ctx.bm25Results = merged.slice(0, ctx.maxBm25Results);

    // Update selectedFiles with top BM25 results
    const topPaths = ctx.bm25Results.map(r => r.path);
    ctx.selectedFiles = deduplicatePaths([
      ...ctx.selectedFiles,
      ...topPaths,
    ]);

    // Emit debug event for UI
    ctx.eventBus.emit({
      kind: 'debug_bm25_results',
      results: ctx.bm25Results.map(r => ({ path: r.path, score: r.score, reason: r.reason })),
    });

    return { status: 'continue' };
  }
}
