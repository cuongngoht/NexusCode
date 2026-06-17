import type { SubagentRole } from '../../subagents/SubagentResultStore';
import type { CodeReviewCategory } from '../CodeReviewCategory';
import { BaseReviewDimension } from './BaseReviewDimension';

export class TestDimension extends BaseReviewDimension {
  readonly role: SubagentRole = 'tester';
  readonly defaultCategory: CodeReviewCategory = 'test';
}
