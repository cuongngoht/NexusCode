import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';
import { CodexOutputParser } from './CodexOutputParser';

export class CodexAgent extends BaseAgent {
  readonly id = 'codex' as const;
  readonly displayName = 'Codex';
  override get outputParser() { return new CodexOutputParser(); }
  readonly capabilities = new AgentCapabilities(
    /* canEditFiles      */ true,
    /* canRunShell       */ true,
    /* canSearchWeb      */ false,
    /* supportsStreaming */ true,
  );
  readonly seededModels: ReadonlyArray<ProviderModel> = [
    { id: 'gpt-5.2', label: 'GPT-5.2', source: 'seeded' },
    { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', source: 'seeded' },
    { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', source: 'seeded' },
    { id: 'gpt-5-codex', label: 'GPT-5 Codex', source: 'seeded' },
    { id: 'o3', label: 'o3', source: 'seeded' },
  ];
  readonly defaultModel = 'gpt-5.2';

  protected readonly executableName = 'codex';

  override async isLoggedIn(): Promise<boolean> {
    return !!process.env['OPENAI_API_KEY'];
  }

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const args = task.model
      ? ['-y', '--model', task.model, task.enhancedPrompt]
      : ['-y', task.enhancedPrompt];
    return new AgentCommand('codex', args, undefined, undefined, task.enhancedPrompt);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
