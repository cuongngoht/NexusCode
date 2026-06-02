import type { IAgent, AgentId, TaskMode, AgentCapabilities } from '../core/agent';
import { AgentRegistry } from './AgentRegistry';

const CAPABILITY_BY_MODE: Record<TaskMode, Partial<AgentCapabilities>> = {
  ask: {},
  research: { canSearchWeb: true },
  'scan-project': { canEditFiles: true },
  plan: {},
  edit: { canEditFiles: true },
  debug: { canRunShell: true },
  test: { canRunShell: true },
  review: { canEditFiles: true },
};

export class AgentRouter {
  constructor(private readonly registry: AgentRegistry) { }

  async resolve(agentId: AgentId, mode: TaskMode): Promise<IAgent> {
    if (agentId !== 'auto') {
      const agent = this.registry.get(agentId);
      if (await agent.isAvailable()) return agent;
      throw new Error(`Agent '${agentId}' is not available`);
    }

    const required = CAPABILITY_BY_MODE[mode];
    const available = await this.findAvailable(required);
    if (!available) throw new Error(`No agent available for mode '${mode}'`);
    return available;
  }

  private async findAvailable(
    required: Partial<AgentCapabilities>,
  ): Promise<IAgent | undefined> {
    const candidates = this.registry
      .getAll()
      .filter(a => a.capabilities.supports(required));

    for (const agent of candidates) {
      if (await agent.isAvailable()) return agent;
    }
    return undefined;
  }
}
