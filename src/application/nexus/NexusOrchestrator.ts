import type { IAgent } from '../../core/agent/IAgent';
import type { AgentId } from '../../core/agent/AgentTask';
import { AgentTask } from '../../core/agent/AgentTask';
import type { AgentResult } from '../../core/agent/AgentResult';
import type { IEventBus } from '../../core/events/IEventBus';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import { AgentRegistry } from '../AgentRegistry';
import { RunAgentUseCase } from '../usecases/RunAgentUseCase';
import { STAGE_PRIORITY, type NexusStage } from './NexusRoutingPolicy';
import { MODE_FLOW, STAGE_CAPABILITIES, isCodingMode } from './ModeCapabilityPolicy';
import { NexusPlanStore } from './NexusPlanStore';

interface StageOutcome {
  ok: boolean;
  agentResult?: AgentResult;
  task?: AgentTask;
}

export class NexusOrchestrator {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly runUseCase: RunAgentUseCase,
    private readonly eventBus: IEventBus,
  ) {}

  async run(ctx: PipelineContext, requestedStage: 'auto' | NexusStage = 'auto'): Promise<void> {
    const flow: NexusStage[] = requestedStage === 'auto' ? MODE_FLOW[ctx.mode] : [requestedStage];
    const willAutoApprove = ctx.autoApprove && flow.includes('plan') && isCodingMode(ctx.mode);
    const totalSteps = willAutoApprove ? flow.length + 1 : flow.length;

    for (let i = 0; i < flow.length; i++) {
      const stage = flow[i];
      const outcome = await this.runStage(stage, ctx, i, totalSteps);
      if (!outcome.ok) return;

      if (stage === 'plan' && isCodingMode(ctx.mode) && outcome.agentResult?.succeeded && outcome.agentResult.stdout.trim()) {
        const plan = outcome.agentResult.stdout.trim();
        const planPath = NexusPlanStore.save(ctx.workspaceRoot, outcome.task!.id, plan);
        this.eventBus.emit({ kind: 'plan_saved', task: outcome.task!, planPath });
        this.eventBus.emit({ kind: 'plan_ready_for_approval', task: outcome.task!, planPath, plan, mode: ctx.mode, model: ctx.model });

        if (!ctx.autoApprove) break;

        ctx.enhancedPrompt = NexusPlanStore.buildApprovedPlanPrompt(plan);
        await this.runStage('code', ctx, i + 1, totalSteps);
        break;
      }
    }
  }

  private async runStage(
    stage: NexusStage,
    ctx: PipelineContext,
    stepIndex: number,
    totalSteps: number,
  ): Promise<StageOutcome> {
    let agent: IAgent;
    try {
      agent = await this.resolveAgent(stage);
    } catch (err) {
      this.eventBus.emit({ kind: 'step_error', stepLabel: stage, error: String(err) });
      return { ok: false };
    }

    this.eventBus.emit({
      kind: 'step_started',
      stepLabel: stage,
      stepIndex,
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

    try {
      const agentResult = await this.runUseCase.executeWithAgent(task, agent);
      this.eventBus.emit({ kind: 'step_completed', stepLabel: stage });
      return { ok: true, agentResult, task };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.eventBus.emit({ kind: 'step_error', stepLabel: stage, error: errMsg });
      return { ok: false };
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
