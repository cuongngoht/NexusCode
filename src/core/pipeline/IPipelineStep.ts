import type { NexusEvent } from '../events/IEventBus';
import type { PipelineContext } from './PipelineContext';

export interface IPipelineStep {
  readonly label: string;
  execute(ctx: PipelineContext, emit: (e: NexusEvent) => void): Promise<void>;
}
