import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand } from '../../core/agent';
import type { AgentTask, AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';

// Grok CLI outputs `** text **` (space after delimiter) which CommonMark treats as literal.
// Normalize to `**text**` so ReactMarkdown renders bold correctly.
function normalizeMarkdownDelimiters(chunk: string): string {
  return chunk
    .replace(/\*\* +/g, '**')
    .replace(/ +\*\*/g, '**')
    .replace(/__ +/g, '__')
    .replace(/ +__/g, '__');
}

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
  protected readonly executableName = 'grok';

  override async isLoggedIn(): Promise<boolean> {
    return true;
  }

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const args = task.model
      ? ['--model', task.model, '--single', task.enhancedPrompt]
      : ['--single', task.enhancedPrompt];
    return new AgentCommand('grok', args, undefined, undefined, task.enhancedPrompt, 'grok');
  }

  transformStdout(chunk: string): string {
    return normalizeMarkdownDelimiters(chunk);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
