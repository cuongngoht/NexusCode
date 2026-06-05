import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';

export class AiderAgent extends BaseAgent {
  readonly id = 'aider' as const;
  readonly displayName = 'Aider';
  readonly capabilities = new AgentCapabilities(
    /* canEditFiles      */ true,
    /* canRunShell       */ true,
    /* canSearchWeb      */ false,
    /* supportsStreaming */ true,
  );
  readonly seededModels: ReadonlyArray<ProviderModel> = [
    { id: 'sonnet', label: 'Claude Sonnet', source: 'seeded' },
    { id: 'opus', label: 'Claude Opus', source: 'seeded' },
    { id: 'gpt-5.2', label: 'GPT-5.2', source: 'seeded' },
    { id: 'gemini/gemini-2.5-pro', label: 'Gemini 2.5 Pro', source: 'seeded' },
  ];
  readonly defaultModel = 'sonnet';

  protected readonly executableName = 'aider';

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const args = task.model
      ? ['--model', task.model, '--message', task.enhancedPrompt]
      : ['--message', task.enhancedPrompt];
    return new AgentCommand('aider', args, undefined, undefined, task.enhancedPrompt);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'text' };
  }
}
