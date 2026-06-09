import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';

export class AntigravityAgent extends BaseAgent {
  readonly id = 'antigravity' as const;
  readonly displayName = 'Antigravity';
  readonly capabilities = new AgentCapabilities(
    /* canEditFiles      */ true,
    /* canRunShell       */ false,
    /* canSearchWeb      */ true,
    /* supportsStreaming */ true,
  );
  readonly seededModels: ReadonlyArray<ProviderModel> = [
    { id: 'gemini-3.5-pro',   label: 'Gemini 3.5 Pro',   source: 'seeded' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', source: 'seeded' },
    { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   source: 'seeded' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', source: 'seeded' },
  ];
  readonly defaultModel = 'gemini-3.5-pro';

  protected readonly executableName = 'agy';

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const args: string[] = [];
    if (task.model) args.push('--model', task.model);
    args.push('--prompt', task.enhancedPrompt);
    return new AgentCommand('agy', args, undefined, undefined, task.enhancedPrompt);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
