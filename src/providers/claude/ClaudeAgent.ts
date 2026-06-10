import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';
import { ClaudeOutputParser } from './ClaudeOutputParser';

export class ClaudeAgent extends BaseAgent {
  readonly id = 'claude' as const;
  readonly displayName = 'Claude';
  override get outputParser() { return new ClaudeOutputParser(); }
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

  override async isLoggedIn(): Promise<boolean> {
    if (process.env['ANTHROPIC_API_KEY']) return true;
    const home = os.homedir();
    const legacyPaths = [
      path.join(home, '.claude', 'auth.json'),
      path.join(home, '.claude', '.credentials.json'),
      path.join(home, '.config', 'claude', 'auth.json'),
    ];
    if (legacyPaths.some(p => fs.existsSync(p))) return true;
    try {
      const result = spawnSync('claude', ['auth', 'status'], { timeout: 6_000, encoding: 'utf8', shell: false });
      if (result.stdout) {
        const json = JSON.parse(result.stdout.trim()) as { loggedIn?: boolean };
        return json.loggedIn === true;
      }
    } catch { /* fall through */ }
    return false;
  }

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const args = task.model
      ? ['--dangerously-skip-permissions', '--model', task.model, task.enhancedPrompt]
      : ['--dangerously-skip-permissions', task.enhancedPrompt];
    return new AgentCommand('claude', args, undefined, undefined, task.enhancedPrompt);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
