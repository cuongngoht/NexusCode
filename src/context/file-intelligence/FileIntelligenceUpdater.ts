import * as path from 'path';
import type { FileIntelligenceProfile, FileTouchEvent } from './types';
import type { FileIntelligenceMergePolicy } from './FileIntelligenceMergePolicy';
import type { FileIntelligenceConfidenceScorer } from './FileIntelligenceConfidenceScorer';
import type { FileIntelligenceFreshnessPolicy } from './FileIntelligenceFreshnessPolicy';
import type { FileIntelligenceIgnoreFilter } from './FileIntelligenceIgnoreFilter';

export class FileIntelligenceUpdater {
  constructor(
    private readonly merger: FileIntelligenceMergePolicy,
    private readonly scorer: FileIntelligenceConfidenceScorer,
    private readonly freshnessPolicy: FileIntelligenceFreshnessPolicy,
    private readonly ignoreFilter: FileIntelligenceIgnoreFilter,
  ) {}

  update(
    existing: FileIntelligenceProfile | undefined,
    event: FileTouchEvent,
  ): FileIntelligenceProfile {
    const absolutePath = path.join(event.workspaceRoot, event.filePath);
    const contentHash = this.freshnessPolicy.computeContentHash(absolutePath);
    const freshness = existing
      ? this.freshnessPolicy.checkFreshness(existing, absolutePath)
      : 'fresh';
    const baseConfidence = this.scorer.score(event);
    const confidence = existing
      ? this.scorer.merge(existing.confidence, baseConfidence)
      : baseConfidence;

    const profile = this.merger.apply(existing, event, confidence, freshness, contentHash);
    return this.ignoreFilter.redactProfile(profile);
  }
}
