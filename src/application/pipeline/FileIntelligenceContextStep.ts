import { spawnSync } from 'child_process';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';
import type { IFileIntelligenceStore } from '../../context/file-intelligence/FileIntelligenceStore';
import type { FileIntelligenceIgnoreFilter } from '../../context/file-intelligence/FileIntelligenceIgnoreFilter';
import { FileIntelligenceContextSelector } from '../../context/file-intelligence/FileIntelligenceContextSelector';
import { FileIntelligenceContextBuilder } from '../../context/file-intelligence/FileIntelligenceContextBuilder';

export class FileIntelligenceContextStep implements IPipelineStep {
  readonly label = 'file-intelligence';

  constructor(
    private readonly store: IFileIntelligenceStore,
    private readonly ignoreFilter: FileIntelligenceIgnoreFilter,
  ) {}

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    try {
      const recentlyChangedFiles = this.getGitChangedFiles(ctx.workspaceRoot);

      const selector = new FileIntelligenceContextSelector(this.store, this.ignoreFilter);
      const profiles = await selector.select(
        {
          prompt: ctx.originalPrompt,
          workspaceRoot: ctx.workspaceRoot,
          recentlyChangedFiles,
          mode: ctx.mode,
        },
        { maxProfiles: 8, maxCharsPerProfile: 1200 },
      );

      if (profiles.length === 0) return;

      const builder = new FileIntelligenceContextBuilder();
      const contextStr = builder.build(profiles, { maxCharsPerProfile: 1200, maxTotalChars: 9600 });
      if (contextStr) {
        ctx.fileIntelligenceContext = contextStr;
      }
    } catch {
      // non-blocking — never crash the pipeline
    }
  }

  private getGitChangedFiles(workspaceRoot: string): string[] {
    try {
      const result = spawnSync('git', ['diff', '--name-only', 'HEAD'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        timeout: 5000,
        shell: false,
      });
      if (result.status !== 0 || !result.stdout) return [];
      return result.stdout
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}
