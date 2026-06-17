import type { SubagentRole } from '../../subagents/SubagentResultStore';
import type { SubagentFinding, SubagentFindingSeverity } from '../../subagents/SubagentOutputSchema';
import type { CodeReviewFinding } from '../CodeReviewFinding';
import type { CodeReviewCategory } from '../CodeReviewCategory';
import type { CodeReviewSeverity } from '../CodeReviewSeverity';
import type { IReviewDimension } from './IReviewDimension';
import { CodeReviewPolicy } from '../CodeReviewPolicy';

const SEVERITY_MAP: Record<SubagentFindingSeverity, CodeReviewSeverity> = {
  high: 'critical',
  medium: 'major',
  low: 'minor',
  info: 'info',
};

export abstract class BaseReviewDimension implements IReviewDimension {
  abstract readonly role: SubagentRole;
  abstract readonly defaultCategory: CodeReviewCategory;

  private readonly policy = new CodeReviewPolicy();

  adapt(findings: SubagentFinding[], confidence: number): CodeReviewFinding[] {
    return findings.map(f => this.adaptFinding(f, confidence));
  }

  protected adaptFinding(f: SubagentFinding, confidence: number): CodeReviewFinding {
    return this.policy.normalizeFinding({
      severity: SEVERITY_MAP[f.severity] ?? 'info',
      category: this.getCategory(f),
      title: f.title,
      description: f.evidence?.join('\n') || f.title,
      recommendation: f.recommendation ?? '',
      evidence: f.evidence?.join('\n') || undefined,
      confidence,
      blocking: f.severity === 'high',
      filePath: f.files?.[0],
    });
  }

  protected getCategory(_finding: SubagentFinding): CodeReviewCategory {
    return this.defaultCategory;
  }
}
