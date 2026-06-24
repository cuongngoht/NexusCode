import type { IFileIntelligenceStore } from './FileIntelligenceStore';
import type { FileIntelligenceIgnoreFilter } from './FileIntelligenceIgnoreFilter';
import type { FileIntelligenceProfile } from './types';
import type { TaskMode } from '../../core/agent/AgentTask';
import type { FileIntelligenceRagFacade } from './FileIntelligenceRagFacade';

const FILE_PATH_PATTERN = /[\w./\-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|java|rs|rb|php|cs|cpp|c|h|swift)/g;

export interface SelectionInput {
  prompt: string;
  workspaceRoot: string;
  recentlyChangedFiles?: string[];
  mode: TaskMode;
}

export interface SelectionOptions {
  maxProfiles?: number;
  maxCharsPerProfile?: number;
}

export class FileIntelligenceContextSelector {
  constructor(
    private readonly store: IFileIntelligenceStore,
    private readonly ignoreFilter: FileIntelligenceIgnoreFilter,
    private readonly ragFacade?: FileIntelligenceRagFacade,
  ) {}

  async select(input: SelectionInput, opts?: SelectionOptions): Promise<FileIntelligenceProfile[]> {
    const max = opts?.maxProfiles ?? 8;
    const selected: FileIntelligenceProfile[] = [];
    const seen = new Set<string>();

    const addIfNew = (profile: FileIntelligenceProfile) => {
      if (!seen.has(profile.filePath) && !this.ignoreFilter.shouldIgnore(profile.filePath)) {
        seen.add(profile.filePath);
        selected.push(profile);
      }
    };

    // 1. Files mentioned in prompt
    const mentionedPaths = this.extractMentionedFiles(input.prompt);
    const mentionedProfiles = await this.loadProfilesForPaths(input.workspaceRoot, mentionedPaths);
    for (const p of mentionedProfiles) {
      if (selected.length >= max) break;
      addIfNew(p);
    }

    if (selected.length >= max) return selected;

    // 2. BM25 semantic search — finds files relevant to the prompt even if not mentioned by name
    if (this.ragFacade) {
      const bm25Profiles = await this.ragFacade.search(input.prompt, input.workspaceRoot, { maxResults: max });
      for (const p of bm25Profiles) {
        if (selected.length >= max) break;
        addIfNew(p);
      }
    }

    if (selected.length >= max) return selected;

    // 3. Recently changed files
    if (input.recentlyChangedFiles) {
      const changedProfiles = await this.loadProfilesForPaths(input.workspaceRoot, input.recentlyChangedFiles);
      for (const p of changedProfiles) {
        if (selected.length >= max) break;
        addIfNew(p);
      }
    }

    if (selected.length >= max) return selected;

    // 4. Remaining from index: risky files, then by finding count, then by confidence
    const index = await this.store.readIndex(input.workspaceRoot);
    if (!index) return selected;

    const remaining = index.profiles
      .filter(p => !seen.has(p.filePath) && !this.ignoreFilter.shouldIgnore(p.filePath))
      .sort((a, b) => b.confidence - a.confidence);

    // Load all remaining candidates in bulk
    const candidates = await this.loadProfilesForPaths(
      input.workspaceRoot,
      remaining.map(p => p.filePath),
    );

    // Sort: risky first, then by finding count desc, then by updatedAt desc
    candidates.sort((a, b) => {
      const aRisk = (a.knownRisks?.length ?? 0) + (a.reviewFindings?.length ?? 0) + (a.debugFindings?.length ?? 0);
      const bRisk = (b.knownRisks?.length ?? 0) + (b.reviewFindings?.length ?? 0) + (b.debugFindings?.length ?? 0);
      if (aRisk !== bRisk) return bRisk - aRisk;
      return b.updatedAt - a.updatedAt;
    });

    for (const p of candidates) {
      if (selected.length >= max) break;
      addIfNew(p);
    }

    return selected;
  }

  private extractMentionedFiles(prompt: string): string[] {
    const matches = prompt.match(FILE_PATH_PATTERN) ?? [];
    return [...new Set(matches)];
  }

  private async loadProfilesForPaths(
    workspaceRoot: string,
    paths: string[],
  ): Promise<FileIntelligenceProfile[]> {
    const results = await Promise.all(
      paths.map(p => this.store.read(workspaceRoot, p).catch(() => undefined)),
    );
    return results.filter((p): p is FileIntelligenceProfile => p !== undefined);
  }
}
