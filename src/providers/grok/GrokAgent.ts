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
    { id: 'grok-build',             label: 'Grok Build',         source: 'seeded' },
    { id: 'grok-composer-2.5-fast', label: 'Grok Composer Fast', source: 'seeded' },
    { id: 'grok-3',                 label: 'Grok 3',             source: 'seeded' },
    { id: 'grok-3-mini',            label: 'Grok 3 Mini',        source: 'seeded' },
  ];
  readonly defaultModel = 'grok-build';
  protected readonly executableName = 'grok';

  override async isLoggedIn(): Promise<boolean> {
    return true;
  }

  protected doBuildCommand(task: AgentTask): AgentCommand {
    // --output-format streaming-json forces the CLI to flush one JSON line per token
    // instead of buffering 4-8 KB in the OS pipe (the behaviour when stdout is not a TTY).
    // --disallowed-tools run_terminal_cmd: grok-build has a param constraint where
    // auto_background_on_timeout=true requires enabled_background=true, causing an
    // "agent building failed" crash. Disabling the tool bypasses the constraint.
    const args: string[] = [
      '--output-format', 'streaming-json',
      '--disallowed-tools', 'run_terminal_cmd',
    ];
    if (task.model) args.push('--model', task.model);
    args.push('--single', task.enhancedPrompt);
    return new AgentCommand('grok', args, undefined, undefined, task.enhancedPrompt, 'grok');
  }

  transformStdout(chunk: string): string {
    return normalizeMarkdownDelimiters(chunk);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
