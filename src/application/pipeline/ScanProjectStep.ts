import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';
import { BuildProjectMapUseCase } from '../usecases/BuildProjectMapUseCase';

export class ScanProjectStep implements IPipelineStep {
  readonly label = 'scan';

  constructor(private readonly buildProjectMap: BuildProjectMapUseCase) {}

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    const result = await this.buildProjectMap.execute({ workspaceRoot: ctx.workspaceRoot });
    ctx.projectMap = result.markdown;
  }
}
