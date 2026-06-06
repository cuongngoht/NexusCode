import { BaseAgent } from '../base/BaseAgent';
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent';
import type { AgentOutput } from '../../core/agent';
import type { ProviderModel } from '../../core/types';

export class NexusAgent extends BaseAgent {
  readonly id = 'nexus' as const;
  readonly displayName = 'Nexus';
  readonly capabilities = new AgentCapabilities(
    /* canEditFiles      */ true,
    /* canRunShell       */ true,
    /* canSearchWeb      */ true,
    /* supportsStreaming */ true,
  );
  readonly seededModels: ReadonlyArray<ProviderModel> = [];
  protected readonly executableName = '';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  protected doBuildCommand(_task: AgentTask): AgentCommand {
    throw new Error('NexusAgent does not build commands — use NexusOrchestrator');
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'text' };
  }
}
