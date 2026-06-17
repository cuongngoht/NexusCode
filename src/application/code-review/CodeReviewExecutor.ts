import type { CodeReviewTarget } from './CodeReviewTarget';
import type { CodeReviewReport } from './CodeReviewReport';
import type { CodeReviewPreset } from './CodeReviewPromptBuilder';
import { CodeReviewContextBuilder } from './CodeReviewContextBuilder';
import { CodeReviewPromptBuilder } from './CodeReviewPromptBuilder';
import { CodeReviewResultParser } from './CodeReviewResultParser';
import { CodeReviewPolicy } from './CodeReviewPolicy';
import { CodeReviewArchitecturePolicy } from './CodeReviewArchitecturePolicy';

export interface RunCodeReviewInput {
  workspaceRoot: string;
  target: CodeReviewTarget;
  userPrompt?: string;
  preset?: CodeReviewPreset;
  maxDiffChars?: number;
  maxFileContextChars?: number;
  blockBelowScore?: number;
  warnBelowScore?: number;
}

export type CodeReviewRunnerFn = (prompt: string, workspaceRoot: string) => Promise<string>;

export class CodeReviewExecutor {
  private readonly contextBuilder = new CodeReviewContextBuilder();
  private readonly promptBuilder: CodeReviewPromptBuilder;
  private readonly resultParser = new CodeReviewResultParser();
  private readonly policy = new CodeReviewPolicy();
  private readonly archPolicy = new CodeReviewArchitecturePolicy();

  constructor(private readonly runnerFn: CodeReviewRunnerFn, private readonly extensionRoot?: string) {
    this.promptBuilder = new CodeReviewPromptBuilder(extensionRoot);
  }

  async run(input: RunCodeReviewInput): Promise<CodeReviewReport> {
    const {
      workspaceRoot,
      target,
      userPrompt,
      preset = 'architecture',
      maxDiffChars,
      maxFileContextChars,
      blockBelowScore,
      warnBelowScore,
    } = input;

    // Step 1: Build context
    const context = this.contextBuilder.build(workspaceRoot, target, {
      maxDiffChars,
      maxFileContextChars,
    });

    // Step 2: Build prompt
    const prompt = this.promptBuilder.build({ context, userPrompt, preset });

    // Step 3: Run agent
    let rawOutput: string;
    try {
      rawOutput = await this.runnerFn(prompt, workspaceRoot);
    } catch (err) {
      // Return a fallback report if runner fails
      return this.resultParser.parse(
        `Runner failed: ${String(err)}`,
        target,
      );
    }

    // Step 4: Parse result
    const report = this.resultParser.parse(rawOutput, target);

    // Step 5: Normalize all findings through policy
    const normalizedFindings = report.findings.map(f => this.policy.normalizeFinding(f));
    const dedupedFindings = this.policy.dedupeFindings(normalizedFindings);
    const sortedFindings = this.policy.sortFindings(dedupedFindings);

    // Step 6: Recalculate verdict
    const verdict = this.policy.calculateVerdict(sortedFindings);

    // Step 7: Recalculate architecture verdict
    const architectureVerdict = this.archPolicy.calculateArchitectureVerdict(
      sortedFindings,
      report.architectureScore,
      blockBelowScore,
      warnBelowScore,
    );

    // Step 8: Clamp architecture score if present
    const architectureScore = report.architectureScore
      ? this.archPolicy.clampArchitectureScore(report.architectureScore)
      : undefined;

    // Step 9: Calculate stats
    const stats = this.policy.calculateStats(sortedFindings);

    // Step 10: Enrich changed files from context
    const changedFiles = context.changedFiles.map(f => ({
      path: f.path,
      status: f.status,
    }));

    return {
      ...report,
      findings: sortedFindings,
      verdict,
      architectureVerdict,
      architectureScore,
      stats,
      changedFiles,
      baseBranch: context.baseBranch,
      compareBranch: context.compareBranch,
    };
  }
}
