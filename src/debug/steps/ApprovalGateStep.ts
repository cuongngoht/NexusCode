import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';

export class ApprovalGateStep extends BaseDebugStep {
  readonly name = 'debug-approval-gate';
  protected readonly state: DebugState = 'waiting_for_approval';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    // no-edit mode: stop here, never apply fix
    if (ctx.noEdit) {
      ctx.state = 'completed';
      ctx.eventBus.emit({ kind: 'step_completed', stepLabel: this.name });
      return { status: 'stop', message: 'no-edit mode: stopping after plan generation' };
    }

    // autoApprove: mark as approved and continue
    if (ctx.autoApprove) {
      ctx.approved = true;
      return { status: 'continue' };
    }

    // Default: wait for user approval
    ctx.eventBus.emit({
      kind: 'debug_approval_required',
      plan: ctx.plan,
      planPath: undefined,
    });

    ctx.eventBus.emit({ kind: 'step_completed', stepLabel: this.name });

    return {
      status: 'await-approval',
      message: 'Debug plan ready. Waiting for user approval before applying fix.',
    };
  }
}
