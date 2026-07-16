import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';
import { isCompensable } from '../../core/pipeline/ICompensableStep';
import type { SagaJournalEntry } from '../../core/pipeline/SagaJournal';

/** Metadata needed to emit step_started/completed/error events during the saga run. */
export interface StepEventMeta {
  stepOffset: number;
  totalSteps: number;
  provider: string;
  mode: string;
  model?: string;
}

export interface SagaRunnerOptions {
  compensateOnFailure?: boolean;
  isCancellationRequested?: () => boolean;
  /** When provided, SagaRunner emits step lifecycle events (step_started/completed/error). */
  stepEventMeta?: StepEventMeta;
}

export interface SagaRunResult {
  ok: boolean;
  failedStep?: string;
  error?: string;
  /** Immutable snapshot of the journal after the run completes. */
  journal: ReadonlyArray<Readonly<SagaJournalEntry>>;
}

export class SagaRunner {
  async run(
    steps: IPipelineStep[],
    ctx: PipelineContext,
    emit: (e: NexusEvent) => void,
    options: SagaRunnerOptions = {},
  ): Promise<SagaRunResult> {
    const { compensateOnFailure = false, isCancellationRequested, stepEventMeta } = options;
    const journal: SagaJournalEntry[] = [];
    const completed: IPipelineStep[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (isCancellationRequested?.()) {
        if (stepEventMeta) {
          emit({ kind: 'step_error', stepLabel: step.label, error: 'Task cancelled' });
        }
        return { ok: false, failedStep: step.label, error: 'Task cancelled', journal };
      }

      const warningCountBefore = ctx.stepWarnings?.length ?? 0;

      if (stepEventMeta) {
        emit({
          kind: 'step_started',
          stepLabel: step.label,
          stepIndex: stepEventMeta.stepOffset + i,
          totalSteps: stepEventMeta.totalSteps,
          provider: stepEventMeta.provider,
          mode: stepEventMeta.mode,
          model: stepEventMeta.model,
        });
      }

      const entry: SagaJournalEntry = {
        stepLabel: step.label,
        startedAt: Date.now(),
        status: 'running',
      };
      journal.push(entry);

      try {
        await step.execute(ctx, emit);
        entry.status = 'completed';
        entry.completedAt = Date.now();
        completed.push(step);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        entry.status = 'failed';
        entry.error = errMsg;

        if (stepEventMeta) {
          emit({ kind: 'step_error', stepLabel: step.label, error: errMsg });
        }

        if (compensateOnFailure) {
          await this.compensate(completed, ctx, emit, journal);
        }
        return { ok: false, failedStep: step.label, error: errMsg, journal };
      }

      // Check cancellation after a successful step, before emitting completed.
      if (isCancellationRequested?.()) {
        if (stepEventMeta) {
          emit({ kind: 'step_error', stepLabel: step.label, error: 'Task cancelled' });
        }
        return { ok: false, failedStep: step.label, error: 'Task cancelled', journal };
      }

      if (stepEventMeta) {
        const warnings = (ctx.stepWarnings ?? [])
          .slice(warningCountBefore)
          .filter(w => w.stepLabel === step.label);
        if (warnings.length > 0) {
          emit({ kind: 'step_error', stepLabel: step.label, error: warnings.map(w => w.message).join('\n') });
        } else {
          emit({ kind: 'step_completed', stepLabel: step.label });
        }
      }
    }

    return { ok: true, journal };
  }

  private async compensate(
    completedSteps: IPipelineStep[],
    ctx: PipelineContext,
    emit: (e: NexusEvent) => void,
    journal: SagaJournalEntry[],
  ): Promise<void> {
    for (const step of [...completedSteps].reverse()) {
      if (!isCompensable(step)) continue;
      const entry = journal.find(e => e.stepLabel === step.label && e.status === 'completed');
      if (entry) entry.status = 'compensating';
      try {
        await step.compensate(ctx, emit);
        if (entry) entry.status = 'compensated';
      } catch (err) {
        if (entry) entry.status = 'failed';
        const errMsg = err instanceof Error ? err.message : String(err);
        emit({ kind: 'step_error', stepLabel: step.label, error: `compensate failed: ${errMsg}` });
      }
    }
  }
}
