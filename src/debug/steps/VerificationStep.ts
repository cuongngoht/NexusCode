import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';
import { assessDebugCommand } from '../tools/SafeCommandPolicy';
import { runDiagnosticCommand } from '../tools/DebugToolRunner';

export class VerificationStep extends BaseDebugStep {
  readonly name = 'debug-verify';
  protected readonly state: DebugState = 'verifying';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    if (!ctx.rerunAfterFix) {
      return { status: 'continue' };
    }

    if (!ctx.verificationCommand) {
      return { status: 'continue' };
    }

    const decision = assessDebugCommand(ctx.verificationCommand);
    if (!decision.allowed) {
      ctx.evidence.push(`[VerificationStep] Verification command blocked by policy: ${decision.reason}`);
      return { status: 'continue' };
    }

    ctx.eventBus.emit({
      kind: 'debug_verification_started',
      command: ctx.verificationCommand,
    });

    const result = runDiagnosticCommand(ctx.verificationCommand, ctx.workspaceRoot);
    const succeeded = result.exitCode === 0;
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(0, 3000);

    ctx.evidence.push(
      `[VerificationStep] ${ctx.verificationCommand} → exit ${result.exitCode} (${result.durationMs}ms)${succeeded ? '' : '\n' + output.slice(0, 500)}`
    );

    ctx.eventBus.emit({
      kind: 'debug_verification_completed',
      succeeded,
      output,
    });

    return { status: 'continue' };
  }
}
