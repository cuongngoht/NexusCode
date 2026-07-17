import type { IKnowledgeFactsStore, KnowledgeFact } from '../../context/knowledge-facts';
import { JsonKnowledgeFactsStore } from '../../context/knowledge-facts';
import { EvidenceLivenessChecker } from './EvidenceLivenessChecker';

/**
 * "Independent" evidence = two entries with distinct non-empty taskIds. Time separation isn't a
 * separate requirement — this codebase has no concurrent task execution (RunTaskHandler processes
 * one pipeline at a time), so distinct task IDs already imply distinct timestamps.
 */
export class PromoteKnowledgeFactUseCase {
  constructor(
    private readonly store: IKnowledgeFactsStore = new JsonKnowledgeFactsStore(),
    private readonly livenessChecker: EvidenceLivenessChecker = new EvidenceLivenessChecker(),
  ) {}

  async execute(workspaceRoot: string, fact: KnowledgeFact): Promise<KnowledgeFact> {
    const liveEvidence = fact.evidence.filter(e => this.livenessChecker.isAlive(workspaceRoot, e));

    let updated = fact;

    if (liveEvidence.length === 0) {
      // Only an active fact can go stale — never resurrect or re-flag a rejected/superseded one.
      if (fact.status === 'candidate' || fact.status === 'verified') {
        updated = { ...fact, status: 'stale', updatedAt: Date.now() };
      }
    } else if (fact.status === 'candidate') {
      const distinctTaskIds = new Set(liveEvidence.map(e => e.taskId).filter((id): id is string => !!id));
      if (distinctTaskIds.size >= 2) {
        updated = { ...fact, status: 'verified', verifiedAt: Date.now(), updatedAt: Date.now() };
      }
    }

    if (updated !== fact) {
      await this.store.write(workspaceRoot, updated);
    }
    return updated;
  }
}
