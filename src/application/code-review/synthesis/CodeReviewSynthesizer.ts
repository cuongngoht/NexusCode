import type { SubagentRole } from '../../subagents/SubagentResultStore';

interface SubagentResultLike { role: string; compactOutput: string; error?: string; }
import type { CodeReviewReport } from '../CodeReviewReport';
import type { CodeReviewTarget } from '../CodeReviewTarget';
import { parseSubagentOutput } from '../../subagents/SubagentOutputParser';
import { CodeReviewPolicy } from '../CodeReviewPolicy';
import { CodeReviewArchitecturePolicy } from '../CodeReviewArchitecturePolicy';
import { ReviewDimensionFactory } from './ReviewDimensionFactory';

export class CodeReviewSynthesizer {
  private readonly policy = new CodeReviewPolicy();
  private readonly archPolicy = new CodeReviewArchitecturePolicy();

  synthesize(results: ReadonlyArray<SubagentResultLike>, target: CodeReviewTarget): CodeReviewReport | null {
    const rawFindings = results
      .filter(r => !r.error)
      .flatMap(result => {
        const dimension = ReviewDimensionFactory.forRole(result.role as SubagentRole);
        if (!dimension) return [];
        const parsed = parseSubagentOutput(result.role as SubagentRole, result.compactOutput);
        const confidence = parsed.confidence > 0 ? parsed.confidence : 0.7;
        return dimension.adapt(parsed.findings, confidence);
      });

    if (rawFindings.length === 0) return null;

    const deduped = this.policy.dedupeFindings(rawFindings);
    const sorted = this.policy.sortFindings(deduped);
    const verdict = this.policy.calculateVerdict(sorted);
    const architectureVerdict = this.archPolicy.calculateArchitectureVerdict(sorted, undefined);
    const stats = this.policy.calculateStats(sorted);

    const successRoles = results
      .filter(r => !r.error && ReviewDimensionFactory.forRole(r.role as SubagentRole))
      .map(r => r.role);
    const timedOutRoles = results
      .filter(r => r.error && /timed out/i.test(r.error))
      .map(r => r.role);

    const roleNames = successRoles.join(', ') || 'none';
    const timeoutNote = timedOutRoles.length > 0
      ? ` Note: ${timedOutRoles.join(', ')} timed out.`
      : '';

    return {
      id: `synth-${Date.now()}`,
      target,
      summary: `Multi-agent review (${roleNames}): ${sorted.length} finding(s).${timeoutNote}`,
      verdict,
      architectureVerdict,
      findings: sorted,
      changedFiles: [],
      stats,
      generatedAt: Date.now(),
    };
  }
}
