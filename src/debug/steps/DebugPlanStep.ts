import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';
import { buildDebugPlan } from '../writers/DebugPlanWriter';
import { DebugSessionWriter } from '../writers/DebugSessionWriter';
import { NexusPlanStore } from '../../application/nexus/NexusPlanStore';

export class DebugPlanStep extends BaseDebugStep {
  readonly name = 'debug-plan';
  protected readonly state: DebugState = 'planning';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    // Build the plan from gathered evidence
    const rootCause = this.extractRootCause(ctx);

    const plan = buildDebugPlan({
      rootCause,
      confidence: ctx.signal?.confidence ?? 0.3,
      evidence: ctx.evidence,
      selectedFiles: ctx.selectedFiles,
      verificationCommand: ctx.verificationCommand,
      noEdit: ctx.noEdit,
      addRegressionTest: ctx.addRegressionTest,
    });

    ctx.plan = plan;

    // Persist plan to NexusPlanStore (reuse existing plan store for approval flow compatibility)
    const sessionId = ctx.taskId ?? `debug-${Date.now()}`;
    let planPath: string | undefined;
    try {
      planPath = NexusPlanStore.save(ctx.workspaceRoot, sessionId, plan.rawMarkdown);
    } catch {
      // non-fatal: plan still exists in ctx.plan
    }

    // Also write to debug session directory
    try {
      const writer = new DebugSessionWriter(ctx.workspaceRoot, sessionId);
      writer.writePlan(plan.rawMarkdown);
    } catch {
      // non-fatal
    }

    // Emit debug_plan_ready event
    ctx.eventBus.emit({
      kind: 'debug_plan_ready',
      plan,
      planPath,
    });

    // Emit plan_ready_for_approval for compatibility with existing UI plan card
    // We need a fake AgentTask here — use a minimal stub that satisfies the type
    const fakeTask = {
      id: sessionId,
      prompt: ctx.originalPrompt,
      enhancedPrompt: ctx.enhancedPrompt ?? ctx.originalPrompt,
      agentId: 'nexus' as const,
      mode: ctx.mode,
      model: ctx.model,
      cwd: ctx.workspaceRoot,
      status: 'completed' as const,
      start: () => {},
      cancel: () => {},
      complete: () => {},
    } as any;

    ctx.eventBus.emit({
      kind: 'plan_ready_for_approval',
      task: fakeTask,
      planPath,
      plan: plan.rawMarkdown,
      mode: ctx.mode,
      model: ctx.model,
    });

    return { status: 'continue' };
  }

  private extractRootCause(ctx: DebugChainContext): string | undefined {
    if (!ctx.signal || ctx.signal.kind === 'unknown') return undefined;

    // Look for root cause hints in evidence
    for (const e of ctx.evidence) {
      if (e.toLowerCase().includes('root cause') || e.toLowerCase().includes('because')) {
        return e.slice(0, 300);
      }
    }

    // Fall back to signal-based hypothesis
    if (ctx.signal.files.length > 0) {
      const file = ctx.signal.files[0];
      const loc = file.line ? ` at line ${file.line}` : '';
      return `${ctx.signal.kind} detected in ${file.path}${loc}`;
    }

    return undefined;
  }
}
