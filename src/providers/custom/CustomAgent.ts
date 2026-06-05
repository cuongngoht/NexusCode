import * as vscode from 'vscode';
import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';
import { CommandGuard } from '../../runner/commandGuard';

export class CustomAgent extends BaseAgent {
  readonly id = 'custom' as const;
  readonly displayName = 'Custom';
  readonly capabilities = new AgentCapabilities(
    /* canEditFiles      */ true,
    /* canRunShell       */ true,
    /* canSearchWeb      */ false,
    /* supportsStreaming */ true,
  );
  readonly seededModels: ReadonlyArray<ProviderModel> = [];

  protected get executableName(): string {
    return vscode.workspace
      .getConfiguration('nexus')
      .get<string>('customProvider.command') ?? '';
  }

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const cfg = vscode.workspace.getConfiguration('nexus');
    const command = cfg.get<string>('customProvider.command') ?? '';
    const template = cfg.get<string[]>('customProvider.args') ?? ['{{prompt}}'];

    CommandGuard.validate(command);

    const args = template.map(a =>
      a.replace('{{prompt}}', task.enhancedPrompt)
        .replace('{{model}}', task.model ?? ''),
    );
    return new AgentCommand(command, args, undefined, undefined, task.enhancedPrompt);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'text' };
  }
}
