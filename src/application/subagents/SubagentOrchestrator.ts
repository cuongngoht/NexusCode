import type { NexusEvent } from '../../core/events/IEventBus';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { SubagentPlanner, SubagentPlanConfig } from './SubagentPlanner';
import type { SubagentRouter } from './SubagentRouter';
import type { SubagentExecutor } from './SubagentExecutor';
import type { SubagentResult } from './SubagentResultStore';
import { buildDagPlan } from './SubagentDagPlanner';

export interface SubagentRunConfig extends SubagentPlanConfig {
  maxCharsPerResult: number;
  failOpen?: boolean;
  timeoutMs?: number;
  injectMaxChars?: number;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  onTimeout?: () => void | Promise<void>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      void Promise.resolve(onTimeout?.()).finally(() => {
        reject(new Error(`Subagent '${label}' timed out after ${timeoutMs}ms`));
      });
    }, timeoutMs);
    promise.then(
      v => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      e => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      },
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

  async stop(): Promise<void> {
    await this.executor.stop();
  }

  async run(
    ctx: PipelineContext,
    emit: (e: NexusEvent) => void,
    config: SubagentRunConfig,
    stepOffset: number,
    totalSteps: number,
  ): Promise<SubagentResult[]> {
    const defs = this.planner.plan(config);

    if (defs.length === 0) return [];

    // SubagentExecutor is wired with one ProcessRunner today, so run serially to avoid
    // competing child processes and cross-cancelling on timeout.
    const maxParallel = 1;
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
          emit({ kind: 'subagent_started', role: def.role, runId: ctx.providerId + '-' + def.role, displayName: def.displayName });

          const agent = await this.router.resolve(def, ctx.providerId);
          if (!agent) {
            emit({ kind: 'step_completed', stepLabel });
            return;
          }

          const subagentStartMs = Date.now();
          try {
            const resultPromise = this.executor.execute(def, agent, ctx, config.maxCharsPerResult, timeoutMs);
            const result = await withTimeout(resultPromise, timeoutMs, role, () => this.executor.stop());
            const elapsed = Date.now() - subagentStartMs;
            results.push(result);

            if (result.error) {
              emit({ kind: 'subagent_failed', role: def.role, runId: ctx.providerId + '-' + def.role, durationMs: elapsed, error: result.error });
              emit({ kind: 'step_error', stepLabel, error: result.error });
            } else {
              emit({
                kind: 'subagent_completed',
                role: def.role,
                runId: ctx.providerId + '-' + def.role,
                durationMs: elapsed,
                confidence: result.confidence,
                findingCount: result.findings?.length ?? 0,
              });
              emit({ kind: 'step_completed', stepLabel });
            }
          } catch (err) {
            const errMsg = String(err);
            const elapsed = Date.now() - subagentStartMs;
            results.push({ role: def.role, agentId: agent?.id ?? 'unknown', compactOutput: '', durationMs: 0, error: errMsg });
            emit({ kind: 'subagent_failed', role: def.role, runId: ctx.providerId + '-' + def.role, durationMs: elapsed, error: errMsg });
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
