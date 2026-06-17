import type { IAgent } from '../../core/agent';
import type { AgentId } from '../../core/agent/AgentTask';
import type { AgentRegistry } from '../AgentRegistry';
import type { SubagentDefinition } from './SubagentDefinition';

export class SubagentRouter {
  constructor(private readonly registry: AgentRegistry) {}

  async resolve(def: SubagentDefinition, activeProviderId?: string): Promise<IAgent | undefined> {
    // Always try the active provider first so subagents use the same CLI as the main task
    const order: AgentId[] = activeProviderId
      ? [activeProviderId as AgentId, ...def.preferredAgentIds.filter(id => id !== activeProviderId)]
      : [...def.preferredAgentIds];

    for (const id of order) {
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
