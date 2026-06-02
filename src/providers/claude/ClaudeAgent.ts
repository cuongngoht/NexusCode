import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';

export class ClaudeAgent extends BaseAgent {
  readonly id = 'claude' as const;
  readonly displayName = 'Claude';
  readonly capabilities = new AgentCapabilities(
    /* canEditFiles      */ true,
    /* canRunShell       */ true,
    /* canSearchWeb      */ false,
    /* supportsStreaming */ true,
  );
  readonly seededModels: ReadonlyArray<ProviderModel> = [
    { id: 'sonnet', label: 'Claude Sonnet', source: 'seeded' },
    { id: 'opus', label: 'Claude Opus', source: 'seeded' },
    { id: 'haiku', label: 'Claude Haiku', source: 'seeded' },
  ];
  readonly defaultModel = 'sonnet';

  protected readonly executableName = 'claude';

  buildCommand(task: AgentTask): AgentCommand {
    const args = task.model
      ? ['--model', task.model, task.enhancedPrompt]
      : [task.enhancedPrompt];
    return new AgentCommand('claude', args);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
