import type { TaskMode } from '../../core/agent/AgentTask';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import { BuildProjectMapUseCase } from '../usecases/BuildProjectMapUseCase';
import { ScanProjectStep } from './ScanProjectStep';

export type PreStepDeps = {
  buildProjectMap: BuildProjectMapUseCase;
};

// Extensibility point: add new pre-steps here when new modes need pre-processing.
export function createPreSteps(mode: TaskMode, deps: PreStepDeps): IPipelineStep[] {
  switch (mode) {
    case 'scan-project':
      return [new ScanProjectStep(deps.buildProjectMap)];
    default:
      return [];
  }
}
