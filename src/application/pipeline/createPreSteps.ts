import type { TaskMode } from '../../core/agent/AgentTask';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import { ScanProjectStep } from './ScanProjectStep';
import { ReadSourceContextStep } from './ReadSourceContextStep';
import { BrainstormAgentsStep } from './BrainstormAgentsStep';
import { DebugPreStep } from './DebugPreStep';
import { ReviewFileContextStep } from './review/ReviewFileContextStep';
import { ArchitectureMemoryStep } from './ArchitectureMemoryStep';
import { FileIntelligenceContextStep } from './FileIntelligenceContextStep';
import type { IFileIntelligenceStore } from '../../context/file-intelligence/FileIntelligenceStore';
import type { FileIntelligenceIgnoreFilter } from '../../context/file-intelligence/FileIntelligenceIgnoreFilter';

export type PreStepDeps = {
  extensionPath: string;
  fileIntelligenceStore?: IFileIntelligenceStore;
  fileIntelligenceIgnoreFilter?: FileIntelligenceIgnoreFilter;
};

function makeFileIntelligenceStep(deps: PreStepDeps): IPipelineStep | null {
  if (!deps.fileIntelligenceStore || !deps.fileIntelligenceIgnoreFilter) return null;
  return new FileIntelligenceContextStep(deps.fileIntelligenceStore, deps.fileIntelligenceIgnoreFilter);
}

function withFileIntelligence(steps: IPipelineStep[], deps: PreStepDeps): IPipelineStep[] {
  const fiStep = makeFileIntelligenceStep(deps);
  return fiStep ? [fiStep, ...steps] : steps;
}

export function createPreSteps(mode: TaskMode, deps: PreStepDeps): IPipelineStep[] {
  switch (mode) {
    case 'scan-project':
      return withFileIntelligence(
        [new ScanProjectStep(deps.extensionPath), new ArchitectureMemoryStep()],
        deps,
      );

    case 'brainstorm':
      return withFileIntelligence(
        [
          new ScanProjectStep(deps.extensionPath),
          new ReadSourceContextStep(),
          new BrainstormAgentsStep(deps.extensionPath),
        ],
        deps,
      );

    case 'debug':
      return withFileIntelligence([new DebugPreStep()], deps);

    case 'review':
      return withFileIntelligence([new ReviewFileContextStep()], deps);

    default:
      return withFileIntelligence([new ArchitectureMemoryStep()], deps);
  }
}
