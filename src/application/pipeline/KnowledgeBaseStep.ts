import type { ICompensableStep } from '../../core/pipeline/ICompensableStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';
import { KnowledgeBaseLoader } from '../../context/knowledge-base/KnowledgeBaseLoader';
import { KnowledgeBaseRagFacade } from '../../context/knowledge-base/search/KnowledgeBaseRagFacade';

export class KnowledgeBaseStep implements ICompensableStep {
  readonly label = 'knowledge-base';

  constructor(
    private readonly loader: KnowledgeBaseLoader = new KnowledgeBaseLoader(),
    private readonly ragFacade: KnowledgeBaseRagFacade = new KnowledgeBaseRagFacade(),
  ) {}

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    try {
      const entries = await this.loader.loadRecentEntries(ctx.workspaceRoot);
      if (entries.length === 0) return;

      const context = this.ragFacade.build(entries, ctx.originalPrompt);
      if (context) {
        ctx.knowledgeBaseContext = context;
      }
    } catch {
      // non-blocking — never crash the pipeline
    }
  }

  async compensate(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    ctx.knowledgeBaseContext = undefined;
  }
}
