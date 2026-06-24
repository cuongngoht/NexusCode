import type { IFileIntelligenceStore } from './FileIntelligenceStore';
import type { FileIntelligenceContextSelector } from './FileIntelligenceContextSelector';
import type { FileIntelligenceContextBuilder } from './FileIntelligenceContextBuilder';
import type { FileIntelligenceIgnoreFilter } from './FileIntelligenceIgnoreFilter';
import { FileIntelligenceContextSelector as ContextSelector } from './FileIntelligenceContextSelector';
import { FileIntelligenceContextBuilder as ContextBuilder } from './FileIntelligenceContextBuilder';

export interface ProjectMemoryStatus {
  fileIntelligenceProfileCount: number;
  hasProfiles: boolean;
}

export interface ProjectMemoryContextPack {
  fileIntelligenceContext: string;
}

export class ProjectMemoryService {
  private readonly selector: FileIntelligenceContextSelector;
  private readonly builder: FileIntelligenceContextBuilder;

  constructor(
    private readonly store: IFileIntelligenceStore,
    ignoreFilter: FileIntelligenceIgnoreFilter,
  ) {
    this.selector = new ContextSelector(store, ignoreFilter);
    this.builder = new ContextBuilder();
  }

  async getStatus(workspaceRoot: string): Promise<ProjectMemoryStatus> {
    try {
      const paths = await this.store.listAll(workspaceRoot);
      return {
        fileIntelligenceProfileCount: paths.length,
        hasProfiles: paths.length > 0,
      };
    } catch {
      return { fileIntelligenceProfileCount: 0, hasProfiles: false };
    }
  }

  async buildContextPack(
    workspaceRoot: string,
    prompt: string,
    mode: import('../../core/agent/AgentTask').TaskMode,
    recentlyChangedFiles?: string[],
  ): Promise<ProjectMemoryContextPack> {
    try {
      const profiles = await this.selector.select(
        { prompt, workspaceRoot, recentlyChangedFiles, mode },
        { maxProfiles: 8, maxCharsPerProfile: 1200 },
      );
      const fileIntelligenceContext = this.builder.build(profiles, {
        maxCharsPerProfile: 1200,
        maxTotalChars: 9600,
      });
      return { fileIntelligenceContext };
    } catch {
      return { fileIntelligenceContext: '' };
    }
  }
}
