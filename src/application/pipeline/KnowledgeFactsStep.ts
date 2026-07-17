import type { ICompensableStep } from '../../core/pipeline/ICompensableStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';
import { KnowledgeFactsLoader } from '../../context/knowledge-facts/KnowledgeFactsLoader';
import { FactsRagFacade } from '../../context/knowledge-facts/search/FactsRagFacade';

export class KnowledgeFactsStep implements ICompensableStep {
  readonly label = 'knowledge-facts';

  constructor(
    private readonly loader: KnowledgeFactsLoader = new KnowledgeFactsLoader(),
    private readonly ragFacade: FactsRagFacade = new FactsRagFacade(),
  ) {}

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    try {
      const facts = await this.loader.loadAll(ctx.workspaceRoot);
      if (facts.length === 0) return;

      const context = this.ragFacade.build(facts, ctx.originalPrompt);
      if (context) {
        ctx.knowledgeFactsContext = context;
      }
    } catch {
      // non-blocking — never crash the pipeline
    }
  }

  async compensate(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    ctx.knowledgeFactsContext = undefined;
  }
}
