import { spawnSync } from 'child_process';
import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';
import { CodexOutputParser } from './CodexOutputParser';

export class CodexAgent extends BaseAgent {
  readonly id = 'codex' as const;
  readonly displayName = 'Codex';
  // Parser only suppresses startup noise (banner, header, echoed prompt).
  // Codex streams plain text — no structured activity events are emitted.
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

  // Capability detection result.
  // 'json'            → --json flag (v0.130+, promoted from --experimental-json)
  // 'experimental'    → --experimental-json flag (intermediate builds)
  // 'legacy'          → no structured output; fall back to TTY state-machine parser
  //
  // Detection parses `codex exec --help` output exactly once (cached per instance).
  // The constructor override allows tests to pin a specific path deterministically
  // without running an actual subprocess.
  private _jsonFlag: 'json' | 'experimental' | 'legacy' | null = null;

  constructor(jsonOutputOverride?: boolean | 'experimental') {
    super();
    if (jsonOutputOverride === true) {
      this._jsonFlag = 'json';
    } else if (jsonOutputOverride === 'experimental') {
      this._jsonFlag = 'experimental';
    } else if (jsonOutputOverride === false) {
      this._jsonFlag = 'legacy';
    }
  }

  private detectJsonFlag(): 'json' | 'experimental' | 'legacy' {
    if (this._jsonFlag !== null) return this._jsonFlag;
    try {
      const result = spawnSync('codex', ['exec', '--help'], {
        timeout: 5000,
        shell: false,
        encoding: 'utf8',
      });
      const help = result.status === 0 ? (result.stdout ?? '') : '';
      if (/^\s*--json\b/m.test(help)) {
        this._jsonFlag = 'json';
      } else if (/^\s*--experimental-json\b/m.test(help)) {
        this._jsonFlag = 'experimental';
      } else {
        this._jsonFlag = 'legacy';
      }
    } catch {
      this._jsonFlag = 'legacy';
    }
    return this._jsonFlag;
  }

  protected doBuildCommand(task: AgentTask): AgentCommand {
    const flag = this.detectJsonFlag();
    const args = [
      '--ask-for-approval',
      'never',
      '--sandbox',
      'workspace-write',
      'exec',
    ];
    if (flag === 'json') {
      args.push('--json');
    } else if (flag === 'experimental') {
      args.push('--experimental-json');
    }
    if (task.model) {
      args.push('--model', task.model);
    }
    args.push(task.enhancedPrompt);
    return new AgentCommand(
      'codex',
      args,
      undefined,
      // When using --json Codex needs a real pipe that closes with EOF rather than
      // /dev/null (what ProcessRunner uses when stdin is undefined). An empty string
      // causes ProcessRunner to open a pipe, write nothing, and immediately close it —
      // giving Codex the clean EOF it needs to initialise its internal session state.
      flag !== 'legacy' ? '' : undefined,
      task.enhancedPrompt,
      flag !== 'legacy' ? 'jsonl' : undefined,
    );
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' };
  }
}
