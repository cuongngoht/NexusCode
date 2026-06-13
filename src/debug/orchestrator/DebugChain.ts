import type { DebugChainContext } from './DebugChainContext';
import type { DebugStep } from './DebugStep';

export class DebugChain {
  constructor(private readonly steps: DebugStep[]) {}

  async run(ctx: DebugChainContext): Promise<void> {
    const total = this.steps.length;
    for (let i = 0; i < this.steps.length; i++) {
      if (ctx.cancelled) {
        return;
      }
      ctx.currentStepIndex = i;
      ctx.totalDebugSteps = total;
      const step = this.steps[i];
      const result = await step.run(ctx);
      if (ctx.cancelled) {
        return;
      }
      if (result.status === 'continue') {
        continue;
      }
      if (result.status === 'await-approval') {
        return;
      }
      if (result.status === 'stop') {
        return;
      }
      throw new Error(result.message ?? `Debug step failed: ${step.name}`);
    }
  }
}
