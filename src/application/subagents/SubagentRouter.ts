import type { IAgent } from '../../core/agent';
import type { AgentRegistry } from '../AgentRegistry';
import type { SubagentDefinition } from './SubagentDefinition';

export class SubagentRouter {
  constructor(private readonly registry: AgentRegistry) {}

  async resolve(def: SubagentDefinition): Promise<IAgent | undefined> {
    for (const id of def.preferredAgentIds) {
      const agent = this.registry.tryGet(id);
      if (!agent) continue;
      try {
        const available = await agent.isAvailable();
        if (!available) continue;
        if (typeof agent.isLoggedIn === 'function') {
          const loggedIn = await agent.isLoggedIn();
          if (!loggedIn) continue;
        }
        return agent;
      } catch {
        // isAvailable never throws per contract, but guard anyway
      }
    }
    return undefined;
  }
}
