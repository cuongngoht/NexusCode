import type { TaskMode } from '../../core/agent/AgentTask';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import { BuildProjectMapUseCase } from '../usecases/BuildProjectMapUseCase';
import { ScanProjectStep } from './ScanProjectStep';
import { ReadSourceContextStep } from './ReadSourceContextStep';
import { BrainstormAgentsStep } from './BrainstormAgentsStep';

export type PreStepDeps = {
  buildProjectMap: BuildProjectMapUseCase;
  extensionPath: string;
};

export function createPreSteps(mode: TaskMode, deps: PreStepDeps): IPipelineStep[] {
  switch (mode) {
    case 'scan-project':
      return [new ScanProjectStep(deps.buildProjectMap)];

    case 'brainstorm':
      return [
        new ScanProjectStep(deps.buildProjectMap),
        new ReadSourceContextStep(),
        new BrainstormAgentsStep(deps.extensionPath),
      ];

    default:
      return [];
  }
}
