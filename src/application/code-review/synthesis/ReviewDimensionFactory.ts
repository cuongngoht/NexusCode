import type { SubagentRole } from '../../subagents/SubagentResultStore';
import type { IReviewDimension } from './IReviewDimension';
import { CorrectnessDimension } from './CorrectnessDimension';
import { SecurityDimension } from './SecurityDimension';
import { ArchitectureDimension } from './ArchitectureDimension';
import { TestDimension } from './TestDimension';

export class ReviewDimensionFactory {
  private static readonly registry = new Map<SubagentRole, IReviewDimension>([
    ['reviewer',  new CorrectnessDimension()],
    ['security',  new SecurityDimension()],
    ['architect', new ArchitectureDimension()],
    ['tester',    new TestDimension()],
  ]);

  static forRole(role: SubagentRole): IReviewDimension | undefined {
    return this.registry.get(role);
  }

  static supportedRoles(): SubagentRole[] {
    return [...this.registry.keys()];
  }
}
