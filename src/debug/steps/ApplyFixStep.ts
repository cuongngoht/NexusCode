import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';
import type { RunAgentUseCase } from '../../application/usecases/RunAgentUseCase';
import { AgentTask } from '../../core/agent/AgentTask';

export class ApplyFixStep extends BaseDebugStep {
  readonly name = 'debug-apply-fix';
  protected readonly state: DebugState = 'editing';

  constructor(private readonly runUseCase?: RunAgentUseCase) {
    super();
  }

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    // Guard: only run if approved
    if (!ctx.approved && !ctx.autoApprove) {
      return { status: 'stop', message: 'Fix not applied: not approved.' };
    }

    if (ctx.noEdit) {
      return { status: 'stop', message: 'Fix not applied: no-edit mode.' };
    }

    if (!ctx.plan) {
      return { status: 'stop', message: 'Fix not applied: no debug plan available.' };
    }

    if (!this.runUseCase) {
      // No agent runner available — log and continue (non-fatal in integration)
      return { status: 'continue' };
    }

    const fixPrompt = this.buildFixPrompt(ctx);

    const task = new AgentTask(
      ctx.originalPrompt,
      fixPrompt,
      ctx.providerId === 'nexus' ? 'claude' : ctx.providerId,
      ctx.mode,
      ctx.model,
      ctx.workspaceRoot,
    );
    // Note: when the outer debug run used provider 'nexus', we deliberately delegate
    // the actual file edit to 'claude' (a strong editor with edit+shell). The model
    // from ctx is still forwarded. This is by design for the debug fix phase.

    try {
      await this.runUseCase.execute(task);
    } catch (err) {
      return {
        status: 'error',
        message: `Apply fix failed: ${String(err)}`,
      };
    }

    return { status: 'continue' };
  }

  private buildFixPrompt(ctx: DebugChainContext): string {
    const plan = ctx.plan!;
    const lines: string[] = [];

    lines.push('Apply the smallest safe fix for this approved debug plan.');
    lines.push('');
    lines.push('Rules:');
    lines.push('- Do not refactor unrelated code.');
    lines.push(`- Do not modify files outside the following list unless necessary: ${plan.filesLikelyToChange.join(', ')}`);
    lines.push('- If changing extra files is necessary, explain why.');
    if (ctx.addRegressionTest) {
      lines.push('- Add or update a regression test that directly exercises the failure condition.');
    }
    lines.push('- After changes, report exact files changed and rationale.');
    lines.push('');
    lines.push('<approved_debug_plan>');
    lines.push(plan.rawMarkdown);
    lines.push('</approved_debug_plan>');
    lines.push('');
    lines.push('## Original Failure');
    lines.push(ctx.originalPrompt);

    return lines.join('\n');
  }
}
