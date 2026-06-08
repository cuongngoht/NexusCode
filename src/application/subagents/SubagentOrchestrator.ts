import type { NexusEvent } from '../../core/events/IEventBus';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { TaskMode } from '../../core/types';
import type { SubagentPlanner, SubagentPlanConfig } from './SubagentPlanner';
import type { SubagentRouter } from './SubagentRouter';
import type { SubagentExecutor } from './SubagentExecutor';
import type { SubagentResult } from './SubagentResultStore';

export interface SubagentRunConfig {
  mode: TaskMode;
  maxRuns: number;
  includeSecurity: boolean;
  includeDocs: boolean;
  maxCharsPerResult: number;
}

export class SubagentOrchestrator {
  constructor(
    private readonly planner: SubagentPlanner,
    private readonly router: SubagentRouter,
    private readonly executor: SubagentExecutor,
  ) {}

  countPlanned(cfg: SubagentPlanConfig): number {
    return this.planner.plan(cfg).length;
  }

  async run(
    ctx: PipelineContext,
    emit: (e: NexusEvent) => void,
    config: SubagentRunConfig,
    stepOffset: number,
    totalSteps: number,
  ): Promise<SubagentResult[]> {
    const defs = this.planner.plan({
      mode: config.mode,
      maxRuns: config.maxRuns,
      includeSecurity: config.includeSecurity,
      includeDocs: config.includeDocs,
    });

    const results: SubagentResult[] = [];

    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const stepLabel = `subagent-${def.role}`;

      emit({
        kind: 'step_started',
        stepLabel,
        stepIndex: stepOffset + i,
        totalSteps,
        provider: ctx.providerId,
        mode: config.mode,
      });

      const agent = await this.router.resolve(def);
      if (!agent) {
        emit({ kind: 'step_completed', stepLabel });
        continue;
      }

      try {
        const result = await this.executor.execute(def, agent, ctx, config.maxCharsPerResult);
        results.push(result);
        if (result.error) {
          emit({ kind: 'step_error', stepLabel, error: result.error });
        } else {
          emit({ kind: 'step_completed', stepLabel });
        }
      } catch (err) {
        // Non-fatal — log and continue so main task can still run
        emit({ kind: 'step_error', stepLabel, error: String(err) });
      }
    }

    return results;
  }
}
