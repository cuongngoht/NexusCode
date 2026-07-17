import type { IKnowledgeFactsStore, KnowledgeFact, KnowledgeStatus } from '../../context/knowledge-facts';
import { JsonKnowledgeFactsStore } from '../../context/knowledge-facts';

export type ContradictionAction = 'auto-supersede' | 'flag-for-review' | 'merge-as-corroborating';

export interface ResolveContradictionResult {
  action: ContradictionAction;
  existing: KnowledgeFact;
  incoming: KnowledgeFact;
}

/**
 * Auto-superseding candidates but requiring human resolution for verified facts is the safer
 * default here: a wrong "fact" silently overriding a correct one is worse than a stale,
 * unresolved contradiction flag, given both get injected into AI prompts.
 */
export function resolveAction(existingStatus: KnowledgeStatus): ContradictionAction {
  if (existingStatus === 'candidate') return 'auto-supersede';
  if (existingStatus === 'verified') return 'flag-for-review';
  return 'merge-as-corroborating';
}

export class ResolveContradictionUseCase {
  constructor(private readonly store: IKnowledgeFactsStore = new JsonKnowledgeFactsStore()) {}

  async execute(workspaceRoot: string, existing: KnowledgeFact, incoming: KnowledgeFact): Promise<ResolveContradictionResult> {
    const action = resolveAction(existing.status);

    if (action === 'auto-supersede') {
      const updatedExisting: KnowledgeFact = { ...existing, status: 'superseded', supersededBy: incoming.id, updatedAt: Date.now() };
      await this.store.write(workspaceRoot, updatedExisting);
      return { action, existing: updatedExisting, incoming };
    }

    if (action === 'flag-for-review') {
      const updatedIncoming: KnowledgeFact = {
        ...incoming,
        contradicts: [...(incoming.contradicts ?? []), existing.canonicalKey],
        reviewRequested: true,
      };
      await this.store.write(workspaceRoot, updatedIncoming);
      return { action, existing, incoming: updatedIncoming };
    }

    // merge-as-corroborating: no confirmed conflict detected — fold the incoming evidence into
    // the existing fact rather than creating a competing one.
    const mergedExisting: KnowledgeFact = {
      ...existing,
      evidence: [...existing.evidence, ...incoming.evidence],
      confidence: Math.min(1, existing.confidence + 0.05),
      updatedAt: Date.now(),
    };
    await this.store.write(workspaceRoot, mergedExisting);
    return { action, existing: mergedExisting, incoming };
  }
}
