import * as fs from 'fs';
import * as crypto from 'crypto';
import type { FileIntelligenceProfile, FileFreshness, DiffMetadata } from './types';

export class FileIntelligenceFreshnessPolicy {
  computeContentHash(absolutePath: string): string | undefined {
    try {
      const content = fs.readFileSync(absolutePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch {
      return undefined;
    }
  }

  checkFreshness(profile: FileIntelligenceProfile, absolutePath: string): FileFreshness {
    const hash = this.computeContentHash(absolutePath);
    if (hash === undefined) return 'archived';
    if (profile.contentHash === undefined) return 'fresh';
    return hash === profile.contentHash ? 'fresh' : 'stale';
  }

  isSmallDiff(diffMeta: DiffMetadata | undefined): boolean {
    if (!diffMeta) return true;
    return diffMeta.linesAdded + diffMeta.linesRemoved < 20;
  }

  shouldUpdateSummary(diffMeta: DiffMetadata | undefined): boolean {
    if (!diffMeta) return false;
    return diffMeta.isMajorChange || diffMeta.linesAdded + diffMeta.linesRemoved >= 20;
  }
}
