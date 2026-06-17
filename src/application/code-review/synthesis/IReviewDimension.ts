import type { SubagentRole } from '../../subagents/SubagentResultStore';
import type { SubagentFinding } from '../../subagents/SubagentOutputSchema';
import type { CodeReviewFinding } from '../CodeReviewFinding';
import type { CodeReviewCategory } from '../CodeReviewCategory';

export interface IReviewDimension {
  readonly role: SubagentRole;
  readonly defaultCategory: CodeReviewCategory;
  adapt(findings: SubagentFinding[], confidence: number): CodeReviewFinding[];
}
