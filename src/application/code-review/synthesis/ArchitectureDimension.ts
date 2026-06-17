import type { SubagentRole } from '../../subagents/SubagentResultStore';
import type { CodeReviewCategory } from '../CodeReviewCategory';
import { BaseReviewDimension } from './BaseReviewDimension';

export class ArchitectureDimension extends BaseReviewDimension {
  readonly role: SubagentRole = 'architect';
  readonly defaultCategory: CodeReviewCategory = 'architecture';
}
