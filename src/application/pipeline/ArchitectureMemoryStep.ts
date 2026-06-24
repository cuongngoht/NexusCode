import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';
import { ArchitectureMemoryLoader, ArchitectureMemoryValidator } from '../../context/architecture-memory';
import { ArchitectureRagFacade } from '../../context/architecture-memory/search/ArchitectureRagFacade';

export class ArchitectureMemoryStep implements IPipelineStep {
  readonly label = 'architecture-memory';

  constructor(
    private readonly loader: ArchitectureMemoryLoader = new ArchitectureMemoryLoader(),
    private readonly validator: ArchitectureMemoryValidator = new ArchitectureMemoryValidator(),
    private readonly ragFacade: ArchitectureRagFacade = new ArchitectureRagFacade(),
  ) {}

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    try {
      const memory = await this.loader.loadMemory(ctx.workspaceRoot);
      if (!memory) return;

      const { valid } = this.validator.validate(memory);
      if (!valid) return;

      const query = buildQuery(ctx);
      const architectureContext = this.ragFacade.build(memory, query);
      if (architectureContext) {
        ctx.architectureContext = architectureContext;
      }
    } catch {
      // non-blocking — never crash the pipeline
    }
  }
}

function buildQuery(ctx: PipelineContext): string {
  const base = ctx.originalPrompt;

  // For review mode, append any file paths from the review target so BM25
  // can score module and violation documents for the changed files.
  if (ctx.mode === 'review' && ctx.reviewTarget) {
    const target = ctx.reviewTarget;
    const paths: string[] = [];
    if (typeof target === 'object' && target !== null) {
      if ('files' in target && Array.isArray((target as { files: unknown[] }).files)) {
        paths.push(...(target as { files: string[] }).files.filter(f => typeof f === 'string'));
      } else if ('path' in target && typeof (target as { path: string }).path === 'string') {
        paths.push((target as { path: string }).path);
      }
    }
    if (paths.length > 0) return `${base} ${paths.join(' ')}`;
  }

  return base;
}
