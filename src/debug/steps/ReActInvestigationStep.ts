import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';
import { ReActLoop } from '../react/ReActLoop';

export class ReActInvestigationStep extends BaseDebugStep {
  readonly name = 'debug-investigate';
  protected readonly state: DebugState = 'investigating';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    if (ctx.reactEnabled === false) {
      return { status: 'continue' };
    }
    const loop = new ReActLoop(ctx.maxInvestigationRounds);
    const result = await loop.run(ctx);

    // Merge evidence
    for (const e of result.evidence) {
      if (!ctx.evidence.includes(e)) {
        ctx.evidence.push(e);
      }
    }

    // Update confidence hint on signal if available
    if (ctx.signal) {
      ctx.signal = {
        ...ctx.signal,
        confidence: Math.max(ctx.signal.confidence, result.confidence),
      };
    }

    // Emit debug event
    ctx.eventBus.emit({
      kind: 'debug_evidence_found',
      evidence: ctx.evidence,
    });

    return { status: 'continue' };
  }
}
