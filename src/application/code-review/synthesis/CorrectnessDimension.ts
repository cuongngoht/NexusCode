import type { SubagentRole } from '../../subagents/SubagentResultStore';
import type { SubagentFinding } from '../../subagents/SubagentOutputSchema';
import type { CodeReviewCategory } from '../CodeReviewCategory';
import { BaseReviewDimension } from './BaseReviewDimension';

const BUG_PATTERN = /crash|null|undefined|throw|exception|incorrect|wrong|broken|fail|error|race|leak/i;

export class CorrectnessDimension extends BaseReviewDimension {
  readonly role: SubagentRole = 'reviewer';
  readonly defaultCategory: CodeReviewCategory = 'maintainability';

  protected getCategory(f: SubagentFinding): CodeReviewCategory {
    if (BUG_PATTERN.test(f.title)) return 'bug';
    return this.defaultCategory;
  }
}
