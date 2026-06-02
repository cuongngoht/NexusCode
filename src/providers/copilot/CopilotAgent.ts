import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';

export class CopilotAgent extends BaseAgent {
  readonly id = 'copilot' as const;
  readonly displayName = 'Copilot';
  readonly capabilities = new AgentCapabilities(
    /* canEditFiles      */ true,
    /* canRunShell       */ false,
    /* canSearchWeb      */ false,
    /* supportsStreaming */ true,
  );
  readonly seededModels: ReadonlyArray<ProviderModel> = [
    { id: 'gpt-5.2', label: 'GPT-5.2', source: 'seeded' },
    { id: 'gpt-5.1', label: 'GPT-5.1', source: 'seeded' },
    { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', source: 'seeded' },
  ];
  readonly defaultModel = 'gpt-5.2';

  protected readonly executableName = 'copilot';

  buildCommand(task: AgentTask): AgentCommand {
    const args = task.model
      ? ['--model', task.model, '--prompt', task.enhancedPrompt]
      : ['--prompt', task.enhancedPrompt];
    return new AgentCommand('copilot', args);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
