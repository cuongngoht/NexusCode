import type { IKnowledgeFactsStore } from '../../context/knowledge-facts';
import { JsonKnowledgeFactsStore } from '../../context/knowledge-facts';

export const MAX_EVIDENCE_PER_FACT = 500;
export const MAX_EVIDENCE_AGE_DAYS = 180;
export const STALE_CLEANUP_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionSweepOutput {
  evidenceTrimmed: number;
  factsDeleted: number;
}

/**
 * A fact whose evidence ages out entirely is never itself deleted here — only stale/superseded
 * facts (already decided to be inactive) are hard-deleted, and only after sitting in that state
 * for STALE_CLEANUP_DAYS. A fact with fresher evidence keeps living even if its oldest evidence
 * ages out of the MAX_EVIDENCE_AGE_DAYS window.
 */
export class RetentionSweepUseCase {
  constructor(private readonly store: IKnowledgeFactsStore = new JsonKnowledgeFactsStore()) {}

  async execute(workspaceRoot: string): Promise<RetentionSweepOutput> {
    const entries = await this.store.listAll(workspaceRoot);
    const now = Date.now();
    const maxEvidenceAgeMs = MAX_EVIDENCE_AGE_DAYS * DAY_MS;
    const staleCleanupMs = STALE_CLEANUP_DAYS * DAY_MS;

    let evidenceTrimmed = 0;
    let factsDeleted = 0;

    for (const entry of entries) {
      const fact = await this.store.read(workspaceRoot, entry.canonicalKey);
      if (!fact) continue;

      const isInactive = fact.status === 'stale' || fact.status === 'superseded';
      if (isInactive && now - fact.updatedAt >= staleCleanupMs) {
        await this.store.delete(workspaceRoot, fact.canonicalKey);
        factsDeleted += 1;
        continue;
      }

      const ageFiltered = fact.evidence.filter(e => now - e.timestamp <= maxEvidenceAgeMs);
      // Evidence is stored oldest-first — keep the newest MAX_EVIDENCE_PER_FACT, drop the rest (FIFO).
      const capped = ageFiltered.length > MAX_EVIDENCE_PER_FACT
        ? ageFiltered.slice(ageFiltered.length - MAX_EVIDENCE_PER_FACT)
        : ageFiltered;

      if (capped.length !== fact.evidence.length) {
        evidenceTrimmed += fact.evidence.length - capped.length;
        await this.store.write(workspaceRoot, { ...fact, evidence: capped, updatedAt: now });
      }
    }

    return { evidenceTrimmed, factsDeleted };
  }
}
