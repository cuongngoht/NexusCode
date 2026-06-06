import type { IAgent, AgentId } from '../core/agent';

export class AgentRegistry {
  private readonly agents = new Map<AgentId, IAgent>();

  register(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent '${agent.id}' is already registered`);
    }
    this.agents.set(agent.id, agent);
  }

  get(id: AgentId): IAgent {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent '${id}' not found`);
    return agent;
  }

  tryGet(id: AgentId): IAgent | undefined {
    return this.agents.get(id);
  }

  getAll(): ReadonlyArray<IAgent> {
    return [...this.agents.values()];
  }
}
