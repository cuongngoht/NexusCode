import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';
import { selectDebugTool } from '../tools/DebugToolSelector';

export class ToolSelectionStep extends BaseDebugStep {
  readonly name = 'debug-tool-selection';
  protected readonly state: DebugState = 'selecting_tools';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    const selection = selectDebugTool({
      suspectedTools: ctx.suspectedTools,
      packageScripts: ctx.packageScripts,
      packageManager: ctx.packageManager,
      failingCommand: ctx.failingCommand,
      detectedLanguage: ctx.detectedLanguage,
    });

    if (selection.selectedTool) {
      ctx.selectedTool = selection.selectedTool;
    }

    if (selection.verificationCommand && !ctx.verificationCommand) {
      ctx.verificationCommand = selection.verificationCommand;
    }

    // Preserve failingCommand if not already set from ParseDebugInputStep
    if (!ctx.failingCommand && ctx.signal?.command) {
      ctx.failingCommand = ctx.signal.command;
    }

    // NOTE: this step does NOT run any commands.
    return { status: 'continue' };
  }
}
