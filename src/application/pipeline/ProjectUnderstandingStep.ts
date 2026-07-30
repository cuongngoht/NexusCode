import type { ICompensableStep } from '../../core/pipeline/ICompensableStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';
import { ProjectUnderstandingLoader } from '../../context/project-understanding/ProjectUnderstandingLoader';
import { ProjectUnderstandingPromptBuilder } from '../../context/project-understanding/ProjectUnderstandingPromptBuilder';

/**
 * Injects the persisted project map into the prompt.
 *
 * Registered on the `default` branch of createPreSteps, so every ordinary mode
 * (ask/edit/plan/test/research) starts with the project's own vocabulary and
 * layering already in context. That injection — not the writing — is what makes
 * `understand` mode worth running: the map only pays for itself when later tasks
 * consume it.
 *
 * Deliberately unconditional on prompt content: unlike the RAG-backed steps,
 * there is nothing to retrieve against here. The map is one small document and
 * it is relevant to essentially any question about the codebase.
 */
export class ProjectUnderstandingStep implements ICompensableStep {
  readonly label = 'project-understanding';

  constructor(
    private readonly loader: ProjectUnderstandingLoader = new ProjectUnderstandingLoader(),
    private readonly promptBuilder: ProjectUnderstandingPromptBuilder = new ProjectUnderstandingPromptBuilder(),
  ) {}

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    try {
      const loaded = this.loader.load(ctx.workspaceRoot);
      if (!loaded) return;

      const context = this.promptBuilder.build(loaded);
      if (context) {
        ctx.projectUnderstandingContext = context;
      }
    } catch {
      // non-blocking — never crash the pipeline
    }
  }

  async compensate(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    ctx.projectUnderstandingContext = undefined;
  }
}
