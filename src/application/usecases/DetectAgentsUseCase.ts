import type { AgentId } from '../../core/agent';
import type { ProviderModel } from '../../core/types';
import { AgentRegistry } from '../AgentRegistry';

export interface DetectedAgent {
  id: AgentId;
  displayName: string;
  available: boolean;
  models: ReadonlyArray<ProviderModel>;
  defaultModel?: string;
}

export class DetectAgentsUseCase {
  constructor(private readonly registry: AgentRegistry) { }

  async execute(): Promise<DetectedAgent[]> {
    const results = await Promise.allSettled(
      this.registry.getAll().map(async agent => ({
        id: agent.id,
        displayName: agent.displayName,
        available: await agent.isAvailable(),
        models: agent.seededModels,
        defaultModel: agent.defaultModel,
      })),
    );

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<DetectedAgent>).value);
  }
}
