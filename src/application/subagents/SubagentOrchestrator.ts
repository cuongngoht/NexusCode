import type { NexusEvent } from '../../core/events/IEventBus';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { TaskMode } from '../../core/types';
import type { SubagentPlanner, SubagentPlanConfig } from './SubagentPlanner';
import type { SubagentRouter } from './SubagentRouter';
import type { SubagentExecutor } from './SubagentExecutor';
import type { SubagentResult } from './SubagentResultStore';
import type { SubagentIntent } from './SubagentIntentClassifier';
import { buildDagPlan } from './SubagentDagPlanner';
import { clampMaxParallel } from './SubagentPresetPolicy';

export interface SubagentRunConfig {
  mode: TaskMode;
  maxRuns: number;
  includeSecurity: boolean;
  includeDocs: boolean;
  maxCharsPerResult: number;
  // New fields
  maxParallel?: number;
  failOpen?: boolean;
  timeoutMs?: number;
  injectMaxChars?: number;
  intent?: SubagentIntent;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Subagent '${label}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
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
      intent: config.intent,
    });

    if (defs.length === 0) return [];

    const maxParallel = clampMaxParallel(config.maxParallel ?? 2);
    const failOpen = config.failOpen !== false;
    const timeoutMs = typeof config.timeoutMs === 'number' && config.timeoutMs > 0
      ? config.timeoutMs
      : 30000;

    const dagPlan = buildDagPlan(defs, maxParallel);
    const results: SubagentResult[] = [];
    let stepIndex = stepOffset;

    for (const group of dagPlan.parallelGroups) {
      // Run each group's roles up to maxParallel at a time
      for (let i = 0; i < group.length; i += maxParallel) {
        const batch = group.slice(i, i + maxParallel);

        const batchPromises = batch.map(async role => {
          const def = defs.find(d => d.role === role);
          if (!def) return;

          const stepLabel = `subagent-${role}`;
          emit({
            kind: 'step_started',
            stepLabel,
            stepIndex: stepIndex++,
            totalSteps,
            provider: ctx.providerId,
            mode: config.mode,
          });

          const agent = await this.router.resolve(def);
          if (!agent) {
            emit({ kind: 'step_completed', stepLabel });
            return;
          }

          try {
            const resultPromise = this.executor.execute(def, agent, ctx, config.maxCharsPerResult);
            const result = await withTimeout(resultPromise, timeoutMs, role);
            results.push(result);
            emit(result.error
              ? { kind: 'step_error', stepLabel, error: result.error }
              : { kind: 'step_completed', stepLabel });
          } catch (err) {
            const errMsg = String(err);
            results.push({ role: def.role, agentId: agent?.id ?? 'unknown', compactOutput: '', durationMs: 0, error: errMsg });
            emit({ kind: 'step_error', stepLabel, error: errMsg });
            if (!failOpen) throw err;
          }
        });

        await Promise.all(batchPromises);
      }
    }

    return results;
  }
}
