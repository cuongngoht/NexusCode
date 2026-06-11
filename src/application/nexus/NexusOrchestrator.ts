import type { IAgent } from '../../core/agent/IAgent';
import type { AgentId } from '../../core/agent/AgentTask';
import { AgentTask } from '../../core/agent/AgentTask';
import type { IEventBus } from '../../core/events/IEventBus';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import { AgentRegistry } from '../AgentRegistry';
import { RunAgentUseCase } from '../usecases/RunAgentUseCase';
import { STAGE_PRIORITY, type NexusStage } from './NexusRoutingPolicy';
import { MODE_FLOW, STAGE_CAPABILITIES, isCodingMode } from './ModeCapabilityPolicy';
import { NexusPlanStore } from './NexusPlanStore';

export class NexusOrchestrator {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly runUseCase: RunAgentUseCase,
    private readonly eventBus: IEventBus,
  ) {}

  async run(ctx: PipelineContext, requestedStage: 'auto' | NexusStage = 'auto'): Promise<void> {
    const flow: NexusStage[] = requestedStage === 'auto' ? MODE_FLOW[ctx.mode] : [requestedStage];
    const totalSteps = flow.length;

    for (let i = 0; i < flow.length; i++) {
      const stage = flow[i];

      let agent: IAgent;
      try {
        agent = await this.resolveAgent(stage);
      } catch (err) {
        this.eventBus.emit({ kind: 'step_error', stepLabel: stage, error: String(err) });
        return;
      }

      this.eventBus.emit({
        kind: 'step_started',
        stepLabel: stage,
        stepIndex: i,
        totalSteps,
        provider: `nexus·${agent.displayName.toLowerCase()}`,
        mode: ctx.mode,
        model: ctx.model,
      });

      const task = new AgentTask(
        ctx.originalPrompt,
        ctx.enhancedPrompt,
        agent.id,
        ctx.mode,
        ctx.model,
        ctx.workspaceRoot,
      );

      let result;
      try {
        result = await this.runUseCase.executeWithAgent(task, agent);
      } catch {
        this.eventBus.emit({ kind: 'step_error', stepLabel: stage, error: '' });
        return;
      }

      this.eventBus.emit({ kind: 'step_completed', stepLabel: stage });

      if (stage === 'plan' && isCodingMode(ctx.mode) && result.succeeded && result.stdout.trim()) {
        const planPath = NexusPlanStore.save(ctx.workspaceRoot, task.id, result.stdout.trim());
        this.eventBus.emit({ kind: 'plan_saved', task, planPath });
        break;
      }
    }
  }

  private async resolveAgent(stage: NexusStage): Promise<IAgent> {
    const priority = STAGE_PRIORITY[stage];
    const required = STAGE_CAPABILITIES[stage];

    for (const id of priority) {
      const agent = this.registry.tryGet(id as AgentId);
      if (!agent) continue;
      if (!agent.capabilities.supports(required)) continue;
      if (!(await agent.isAvailable())) continue;
      return agent;
    }
    throw new Error(`No agent available for Nexus stage '${stage}'`);
  }
}
