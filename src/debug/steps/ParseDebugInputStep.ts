import { parseDebugInput, hasNoEditFlag } from '../DebugInputParser';
import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';

export class ParseDebugInputStep extends BaseDebugStep {
  readonly name = 'debug-parse';
  protected readonly state: DebugState = 'parsing';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    const signal = parseDebugInput(ctx.originalPrompt);
    ctx.signal = signal;
    ctx.noEdit = ctx.noEdit || hasNoEditFlag(ctx.originalPrompt);
    ctx.suspectedTools = signal.suspectedTools;

    // Seed selectedFiles from explicit file refs in the signal
    const explicitFiles = signal.files.map(f => f.path);
    for (const f of explicitFiles) {
      if (!ctx.selectedFiles.includes(f)) {
        ctx.selectedFiles.push(f);
      }
    }

    if (signal.command && !ctx.failingCommand) {
      ctx.failingCommand = signal.command;
    }

    return { status: 'continue' };
  }
}
