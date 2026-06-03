import type { AgentId } from '../../core/agent/AgentTask';
import type { IProcessRunner } from '../../core/runner/IProcessRunner';
import type { AgentResult } from '../../core/agent/AgentResult';
import { AgentRegistry } from '../../application/AgentRegistry';
import { AgentTask } from '../../core/agent/AgentTask';

export class ProjectMapAiRunner {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly runner: IProcessRunner,
  ) { }

  async run(input: { provider: AgentId; prompt: string }): Promise<AgentResult> {
    const agent = this.registry.get(input.provider);
    if (!await agent.isAvailable()) {
      throw new Error(`Provider '${input.provider}' is not available`);
    }
    const task = new AgentTask(input.prompt, input.prompt, input.provider, 'ask');
    const command = agent.buildCommand(task);
    return this.runner.run(command);
  }
}
