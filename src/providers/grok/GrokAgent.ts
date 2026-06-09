import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand } from '../../core/agent';
import type { AgentTask, AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';
import { NLOutputParser } from '../base/NLOutputParser';

export class GrokAgent extends BaseAgent {
  readonly id = 'grok' as const;
  readonly displayName = 'Grok';
  readonly capabilities = new AgentCapabilities(true, true, true, true);
  readonly seededModels: ReadonlyArray<ProviderModel> = [
    { id: 'grok-3',      label: 'Grok 3',      source: 'seeded' },
    { id: 'grok-3-mini', label: 'Grok 3 Mini', source: 'seeded' },
    { id: 'grok-2',      label: 'Grok 2',      source: 'seeded' },
    { id: 'grok-2-mini', label: 'Grok 2 Mini', source: 'seeded' },
  ];
  readonly defaultModel = 'grok-3';
  override get outputParser() { return new NLOutputParser(); }
  protected readonly executableName = 'grok';

  override async isLoggedIn(): Promise<boolean> {
    return true;
  }

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const args = task.model
      ? ['--model', task.model, '--single', task.enhancedPrompt]
      : ['--single', task.enhancedPrompt];
    return new AgentCommand('grok', args, undefined, undefined, task.enhancedPrompt);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
