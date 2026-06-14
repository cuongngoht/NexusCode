import { spawnSync } from 'child_process';
import { AgentCommand, AgentTask } from '../../core/agent';
import type { IAgent, AgentId, AgentCapabilities } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { IOutputParser } from '../../core/agent/IOutputParser';
import type { ProviderModel } from '../../core/types';

export abstract class BaseAgent implements IAgent {
  abstract readonly id: AgentId;
  abstract readonly displayName: string;
  abstract readonly capabilities: AgentCapabilities;
  abstract readonly seededModels: ReadonlyArray<ProviderModel>;
  readonly defaultModel?: string;
  get outputParser(): IOutputParser | undefined { return undefined; }
  // All CLI agents output structured JSON in review mode, so suppress raw token stream in chat.
  // Individual agents may override (e.g. set [] to opt out, or add more modes).
  readonly suppressChatStreamModes: ReadonlyArray<string> = ['review'];

  protected abstract readonly executableName: string;

  abstract parseOutput(raw: string): AgentOutput;

  buildCommand(task: AgentTask): AgentCommand {
    if (!task.cwd) {
      return this.doBuildCommand(task);
    }
    const cwdArgs = this.buildCwdArgs(task.cwd);
    if (cwdArgs.length > 0) {
      const base = this.doBuildCommand(task);
      return new AgentCommand(base.executable, [...cwdArgs, ...base.args], base.env, base.stdin, base.inputPrompt, base.transport);
    }
    const augmented = new AgentTask(
      task.prompt,
      `${this.buildCwdInstruction(task.cwd)}\n\n${task.enhancedPrompt}`,
      task.agentId,
      task.mode,
      task.model,
      task.cwd,
    );
    return this.doBuildCommand(augmented);
  }

  protected abstract doBuildCommand(task: AgentTask): AgentCommand;

  // Override to inject cwd via a CLI flag instead of prepending to the prompt.
  // Return the flag args (e.g. ['-s', instruction]); return [] to use prompt injection.
  protected buildCwdArgs(_cwd: string): string[] {
    return [];
  }

  protected buildCwdInstruction(cwd: string): string {
    return (
      `You are working in the directory: ${cwd}\n` +
      `ALWAYS use absolute paths when calling any file tool (read_file, write_file, etc.).\n` +
      `NEVER use relative paths. Every path must start with: ${cwd}`
    );
  }

  async isLoggedIn(): Promise<boolean> {
    return true;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const cmd = process.platform === 'win32' ? 'where' : 'which';
      const result = spawnSync(cmd, [this.executableName], {
        timeout: 5000,
        encoding: 'utf8',
        shell: false,
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }
}
