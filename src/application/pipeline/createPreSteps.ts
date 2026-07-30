import type { TaskMode } from '../../core/agent/AgentTask';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import { ScanProjectStep } from './ScanProjectStep';
import { ReadSourceContextStep } from './ReadSourceContextStep';
import { BrainstormAgentsStep } from './BrainstormAgentsStep';
import { DebugPreStep } from './DebugPreStep';
import { ReviewFileContextStep } from './review/ReviewFileContextStep';
import { ArchitectureMemoryStep } from './ArchitectureMemoryStep';
import { ProjectUnderstandingStep } from './ProjectUnderstandingStep';
import { KnowledgeBaseStep } from './KnowledgeBaseStep';
import { KnowledgeFactsStep } from './KnowledgeFactsStep';
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
    case 'understand':
      // Scan first so the map is authored against fresh structure, then load any
      // existing understanding so the model can revise rather than start over.
      return withFileIntelligence(
        [
          new ScanProjectStep(deps.extensionPath),
          new ArchitectureMemoryStep(),
          new ProjectUnderstandingStep(),
        ],
        deps,
      );

    case 'scan-project':
      // NOTE: this branch is unreachable — RunTaskHandler.run() returns early for
      // 'scan-project' before ever calling createPreSteps(). Do not add KnowledgeBaseStep
      // here; it would just be more dead code.
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
          new KnowledgeBaseStep(),
          new KnowledgeFactsStep(),
        ],
        deps,
      );

    case 'debug':
      return withFileIntelligence(
        [new DebugPreStep(), new ProjectUnderstandingStep(), new KnowledgeBaseStep(), new KnowledgeFactsStep()],
        deps,
      );

    case 'agent':
      // Agent Mode runs these itself inside its scan_project step (via
      // RunAgentModeInput.buildProjectContext) — not through runPreSteps().
      return withFileIntelligence(
        [
          new ScanProjectStep(deps.extensionPath),
          new ProjectUnderstandingStep(),
          new ArchitectureMemoryStep(),
          new KnowledgeBaseStep(),
          new KnowledgeFactsStep(),
        ],
        deps,
      );

    case 'review':
      // NOTE: no withFileIntelligence() here — RunTaskHandler never reads
      // ctx.fileIntelligenceContext for review mode (it already has diff-scoped
      // context from ReviewFileContextStep), so running that step here would
      // just be wasted git + file-intelligence lookups.
      return [new ArchitectureMemoryStep(), new KnowledgeBaseStep(), new KnowledgeFactsStep(), new ReviewFileContextStep()];

    default:
      // ProjectUnderstandingStep is the payoff for `understand` mode: ask, edit,
      // plan, test and research all start with the saved map in context.
      return withFileIntelligence(
        [
          new ProjectUnderstandingStep(),
          new ArchitectureMemoryStep(),
          new KnowledgeBaseStep(),
          new KnowledgeFactsStep(),
        ],
        deps,
      );
  }
}
