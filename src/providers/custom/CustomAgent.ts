import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';
import { CommandGuard } from '../../runner/commandGuard';
import type { ICustomCommandConfigProvider } from '../base/ICustomCommandConfigProvider';

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

  constructor(private readonly config: ICustomCommandConfigProvider) {
    super();
  }

  protected get executableName(): string {
    return this.config.getCommand();
  }

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const command = this.config.getCommand();
    const template = this.config.getArgs();

    CommandGuard.validate(command);

    const args = template.map(a =>
      a.replace('{{prompt}}', task.enhancedPrompt)
        .replace('{{model}}', task.model ?? ''),
    );
    return new AgentCommand(command, args, undefined, undefined, task.enhancedPrompt, 'plain');
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'text' };
  }
}
