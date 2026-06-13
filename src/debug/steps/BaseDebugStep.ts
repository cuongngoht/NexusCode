import type { DebugStep, DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugState } from '../orchestrator/DebugState';

export abstract class BaseDebugStep implements DebugStep {
  abstract readonly name: string;
  protected abstract readonly state: DebugState;

  async run(ctx: DebugChainContext): Promise<DebugStepResult> {
    if (ctx.cancelled) {
      return { status: 'stop', message: 'cancelled' };
    }
    ctx.state = this.state;
    const stepIndex = ctx.currentStepIndex ?? 0;
    const totalSteps = ctx.totalDebugSteps ?? 1;
    ctx.eventBus.emit({
      kind: 'step_started',
      stepLabel: this.name,
      stepIndex,
      totalSteps,
      provider: 'nexus',
      mode: ctx.mode,
      model: ctx.model,
    });
    try {
      const result = await this.execute(ctx);
      if (ctx.cancelled) {
        return { status: 'stop', message: 'cancelled' };
      }
      if (result.status !== 'error') {
        ctx.eventBus.emit({ kind: 'step_completed', stepLabel: this.name });
      }
      return result;
    } catch (err) {
      ctx.state = 'failed';
      ctx.eventBus.emit({
        kind: 'step_error',
        stepLabel: this.name,
        error: String(err),
      });
      return {
        status: 'error',
        message: String(err),
      };
    }
  }

  protected abstract execute(ctx: DebugChainContext): Promise<DebugStepResult>;
}
