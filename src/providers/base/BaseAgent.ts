import { spawnSync } from 'child_process';
import type { IAgent, AgentId, AgentTask, AgentCommand, AgentCapabilities } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';

export abstract class BaseAgent implements IAgent {
  abstract readonly id: AgentId;
  abstract readonly displayName: string;
  abstract readonly capabilities: AgentCapabilities;
  abstract readonly seededModels: ReadonlyArray<ProviderModel>;
  readonly defaultModel?: string;

  protected abstract readonly executableName: string;

  abstract buildCommand(task: AgentTask): AgentCommand;
  abstract parseOutput(raw: string): AgentOutput;

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
