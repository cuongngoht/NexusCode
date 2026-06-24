import type { TaskMode } from '../../core/agent/AgentTask';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import { ScanProjectStep } from './ScanProjectStep';
import { ReadSourceContextStep } from './ReadSourceContextStep';
import { BrainstormAgentsStep } from './BrainstormAgentsStep';
import { DebugPreStep } from './DebugPreStep';
import { ReviewFileContextStep } from './review/ReviewFileContextStep';
import { ArchitectureMemoryStep } from './ArchitectureMemoryStep';

export type PreStepDeps = {
  extensionPath: string;
};

export function createPreSteps(mode: TaskMode, deps: PreStepDeps): IPipelineStep[] {
  switch (mode) {
    case 'scan-project':
      return [new ScanProjectStep(deps.extensionPath), new ArchitectureMemoryStep()];

    case 'brainstorm':
      return [
        new ScanProjectStep(deps.extensionPath),
        new ReadSourceContextStep(),
        new BrainstormAgentsStep(deps.extensionPath),
      ];

    case 'debug':
      return [new DebugPreStep()];

    case 'review':
      return [new ReviewFileContextStep()];

    default:
      return [new ArchitectureMemoryStep()];
  }
}
