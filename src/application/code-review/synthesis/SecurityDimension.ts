import type { SubagentRole } from '../../subagents/SubagentResultStore';
import type { CodeReviewCategory } from '../CodeReviewCategory';
import { BaseReviewDimension } from './BaseReviewDimension';

export class SecurityDimension extends BaseReviewDimension {
  readonly role: SubagentRole = 'security';
  readonly defaultCategory: CodeReviewCategory = 'security';
}
