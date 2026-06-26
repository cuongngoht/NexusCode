import type { IPipelineStep } from './IPipelineStep';
import type { PipelineContext } from './PipelineContext';
import type { NexusEvent } from '../events/IEventBus';

/** A pipeline step that can roll back its own side effects when a later step fails. */
export interface ICompensableStep extends IPipelineStep {
  /** Undo side effects from execute(). Must be idempotent and must not throw. */
  compensate(ctx: PipelineContext, emit: (e: NexusEvent) => void): Promise<void>;
}

export function isCompensable(step: IPipelineStep): step is ICompensableStep {
  return typeof (step as ICompensableStep).compensate === 'function';
}
