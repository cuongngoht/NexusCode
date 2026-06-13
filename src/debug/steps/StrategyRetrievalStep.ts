import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';
import type { DebugSearchStrategy } from '../strategies/DebugSearchStrategy';
import { StackTraceSearchStrategy } from '../strategies/StackTraceSearchStrategy';
import { TypeScriptErrorStrategy } from '../strategies/TypeScriptErrorStrategy';
import { TestFailureStrategy } from '../strategies/TestFailureStrategy';
import { BuildErrorStrategy } from '../strategies/BuildErrorStrategy';
import { GitDiffStrategy } from '../strategies/GitDiffStrategy';
import { ConfigFileStrategy } from '../strategies/ConfigFileStrategy';
import { PythonErrorStrategy } from '../strategies/PythonErrorStrategy';
import { RustErrorStrategy } from '../strategies/RustErrorStrategy';
import { GoErrorStrategy } from '../strategies/GoErrorStrategy';
import { JavaErrorStrategy } from '../strategies/JavaErrorStrategy';
import { CSharpErrorStrategy } from '../strategies/CSharpErrorStrategy';
import { RubyErrorStrategy } from '../strategies/RubyErrorStrategy';
import { GenericRuntimeErrorStrategy } from '../strategies/GenericRuntimeErrorStrategy';
import { mergeSearchResults, deduplicatePaths } from '../search/SearchResultMerger';
import { detectLanguageFromText } from '../language/LanguageDetector';

const ALL_STRATEGIES: DebugSearchStrategy[] = [
  new StackTraceSearchStrategy(),
  new TypeScriptErrorStrategy(),
  new PythonErrorStrategy(),
  new RustErrorStrategy(),
  new GoErrorStrategy(),
  new JavaErrorStrategy(),
  new CSharpErrorStrategy(),
  new RubyErrorStrategy(),
  new TestFailureStrategy(),
  new BuildErrorStrategy(),
  new GitDiffStrategy(),
  new ConfigFileStrategy(),
  // GenericRuntimeErrorStrategy is last: it only activates when nothing more specific matched
  new GenericRuntimeErrorStrategy(),
];

export class StrategyRetrievalStep extends BaseDebugStep {
  readonly name = 'debug-strategy-retrieval';
  protected readonly state: DebugState = 'strategy_retrieval';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    // Populate detectedLanguage from raw error text if not already set by ProjectProfileLoadStep
    if (!ctx.detectedLanguage && ctx.signal?.raw) {
      const langResult = detectLanguageFromText(ctx.signal.raw);
      if (langResult.language !== 'unknown') {
        ctx.detectedLanguage = langResult.language;
      }
    }

    const allStrategyResults = [];

    for (const strategy of ALL_STRATEGIES) {
      if (!strategy.canHandle(ctx)) continue;
      try {
        const results = await strategy.search(ctx);
        allStrategyResults.push(...results);
      } catch {
        // Non-fatal: strategy failure should not block the pipeline
      }
    }

    // Merge and deduplicate
    const merged = mergeSearchResults(ctx.strategyResults, allStrategyResults);
    ctx.strategyResults = merged;

    // Merge into selectedFiles
    ctx.selectedFiles = deduplicatePaths([
      ...ctx.selectedFiles,
      ...merged.map(r => r.path),
    ]);

    return { status: 'continue' };
  }
}
