import type { SubagentResult } from '../../subagents/SubagentResultStore';
import type { CodeReviewReport } from '../CodeReviewReport';
import type { CodeReviewTarget } from '../CodeReviewTarget';
import { parseSubagentOutput } from '../../subagents/SubagentOutputParser';
import { CodeReviewPolicy } from '../CodeReviewPolicy';
import { CodeReviewArchitecturePolicy } from '../CodeReviewArchitecturePolicy';
import { ReviewDimensionFactory } from './ReviewDimensionFactory';

export class CodeReviewSynthesizer {
  private readonly policy = new CodeReviewPolicy();
  private readonly archPolicy = new CodeReviewArchitecturePolicy();

  synthesize(results: SubagentResult[], target: CodeReviewTarget): CodeReviewReport | null {
    const rawFindings = results
      .filter(r => !r.error)
      .flatMap(result => {
        const dimension = ReviewDimensionFactory.forRole(result.role);
        if (!dimension) return [];
        const parsed = parseSubagentOutput(result.role, result.compactOutput);
        const confidence = parsed.confidence > 0 ? parsed.confidence : 0.7;
        return dimension.adapt(parsed.findings, confidence);
      });

    if (rawFindings.length === 0) return null;

    const deduped = this.policy.dedupeFindings(rawFindings);
    const sorted = this.policy.sortFindings(deduped);
    const verdict = this.policy.calculateVerdict(sorted);
    const architectureVerdict = this.archPolicy.calculateArchitectureVerdict(sorted, undefined);
    const stats = this.policy.calculateStats(sorted);

    const roleNames = results
      .filter(r => !r.error && ReviewDimensionFactory.forRole(r.role))
      .map(r => r.role)
      .join(', ');

    return {
      id: `synth-${Date.now()}`,
      target,
      summary: `Multi-agent review (${roleNames}): ${sorted.length} finding(s).`,
      verdict,
      architectureVerdict,
      findings: sorted,
      changedFiles: [],
      stats,
      generatedAt: Date.now(),
    };
  }
}
