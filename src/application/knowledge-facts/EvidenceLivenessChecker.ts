import * as path from 'path';
import { FileIntelligenceFreshnessPolicy } from '../../context/file-intelligence/FileIntelligenceFreshnessPolicy';
import type { KnowledgeEvidence } from '../../context/knowledge-facts/types';

export class EvidenceLivenessChecker {
  constructor(
    private readonly freshnessPolicy: FileIntelligenceFreshnessPolicy = new FileIntelligenceFreshnessPolicy(),
  ) {}

  /** No filePath/contentHash means there's no file to check (e.g. a decision fact) — always alive. */
  isAlive(workspaceRoot: string, evidence: KnowledgeEvidence): boolean {
    if (!evidence.filePath || !evidence.contentHash) return true;

    const absolutePath = path.join(workspaceRoot, evidence.filePath);
    const currentHash = this.freshnessPolicy.computeContentHash(absolutePath);
    if (currentHash === undefined) return false; // file deleted
    return currentHash === evidence.contentHash;
  }
}
