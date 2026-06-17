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

  // agy streams natural-language progress; hiding stdout in review mode leaves only a stuck ✏️ chip.
  readonly suppressChatStreamModes: ReadonlyArray<string> = [];

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const args: string[] = [];
    if (task.model) args.push('--model', task.model);
    if (task.mode === 'review') {
      // Large diffs + many reads; default agy print timeout is 5m.
      args.push('--print-timeout', '20m');
    }
    args.push('--prompt', task.enhancedPrompt, '--dangerously-skip-permissions');
    if (process.env.NEXUS_DEBUG === '1') {
      console.log('[AntigravityAgent] buildCommand', {
        model: task.model,
        mode: task.mode,
        promptLength: task.enhancedPrompt.length,
        promptPreview: task.enhancedPrompt.slice(0, 400),
        args: args.map(a => a.length > 200 ? a.slice(0, 200) + '…' : a),
      });
    }
    return new AgentCommand('agy', args, undefined, undefined, task.enhancedPrompt, 'antigravity');
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
