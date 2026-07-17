import type { KnowledgeEvidence, KnowledgeStatus, KnowledgeEvidenceSource } from './types';

const DETERMINISTIC_SOURCES: KnowledgeEvidenceSource[] = ['git', 'test', 'file'];

/**
 * Deterministic sources are verified immediately — the evidence itself IS the proof, no second
 * observation needed. AI-derived facts (source 'ai', or observedBy 'ai' regardless of the
 * task/review/debug source label) always start as a candidate.
 */
export function initialStatusFor(evidence: KnowledgeEvidence): KnowledgeStatus {
  if (DETERMINISTIC_SOURCES.includes(evidence.source) && evidence.observedBy === 'deterministic') {
    return 'verified';
  }
  return 'candidate';
}
