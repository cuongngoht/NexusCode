import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';
import { DebugSessionWriter } from '../writers/DebugSessionWriter';

export class DebugSummaryStep extends BaseDebugStep {
  readonly name = 'debug-summary';
  protected readonly state: DebugState = 'summarizing';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    const summary = this.buildSummary(ctx);

    // Persist summary
    try {
      const sessionId = ctx.taskId ?? `debug-${Date.now()}`;
      const writer = new DebugSessionWriter(ctx.workspaceRoot, sessionId);
      writer.writeSummary(summary);
    } catch {
      // non-fatal
    }

    ctx.state = 'completed';

    ctx.eventBus.emit({
      kind: 'debug_summary_ready',
      summary,
    });

    return { status: 'stop' };
  }

  private buildSummary(ctx: DebugChainContext): string {
    const lines: string[] = [];

    lines.push('# Debug Summary');
    lines.push('');

    // Root cause
    lines.push('## Root Cause');
    if (ctx.plan?.rootCause) {
      lines.push(ctx.plan.rootCause);
    } else if (ctx.signal && ctx.signal.kind !== 'unknown') {
      lines.push(`${ctx.signal.kind} detected.${ctx.signal.files.length > 0 ? ` Primary file: ${ctx.signal.files[0].path}` : ''}`);
    } else {
      lines.push('_Not determined. See evidence for details._');
    }
    lines.push('');

    // Fix applied
    lines.push('## Fix Applied');
    if (!ctx.approved && !ctx.autoApprove) {
      lines.push('Plan is ready and waiting for approval. No files were modified.');
    } else if (ctx.noEdit) {
      lines.push('NO-EDIT mode was active. No files were modified.');
    } else if (ctx.plan?.minimalFix) {
      lines.push(ctx.plan.minimalFix);
    } else {
      lines.push('Fix was applied per the debug plan.');
    }
    lines.push('');

    // Files changed
    lines.push('## Files Changed');
    if (!ctx.approved && !ctx.autoApprove) {
      lines.push('_None — awaiting approval._');
    } else if (ctx.plan?.filesLikelyToChange.length) {
      for (const f of ctx.plan.filesLikelyToChange) {
        lines.push(`- ${f}`);
      }
    } else {
      lines.push('_Unknown — inspect agent output for details._');
    }
    lines.push('');

    // Verification
    lines.push('## Verification');
    const verifyEvidence = ctx.evidence.filter(e => e.includes('[VerificationStep]'));
    if (verifyEvidence.length > 0) {
      for (const e of verifyEvidence) {
        lines.push(`- ${e.replace('[VerificationStep] ', '')}`);
      }
    } else if (ctx.verificationCommand) {
      lines.push(`Verification command: \`${ctx.verificationCommand}\` (not run)`);
    } else {
      lines.push('_No verification was run._');
    }
    lines.push('');

    // Remaining risks
    lines.push('## Remaining Risks');
    if (ctx.plan?.risk === 'high') {
      lines.push('- Confidence in root cause is low. Manual review recommended.');
    }
    if (!ctx.approved && !ctx.autoApprove) {
      lines.push('- Fix has not been applied yet. Use the approval flow to proceed.');
    }
    if (ctx.evidence.some(e => e.includes('invalid') || e.includes('Could not'))) {
      lines.push('- Some files could not be read during investigation. Coverage may be incomplete.');
    }
    if (ctx.plan?.risk === 'low' && ctx.approved) {
      lines.push('_None identified._');
    }
    lines.push('');

    return lines.join('\n');
  }
}
