export {
  KNOWLEDGE_FACT_SCHEMA_VERSION,
  KNOWLEDGE_FACTS_DIR,
  KNOWLEDGE_FACTS_INDEX_FILE,
  CANDIDATE_CONFIDENCE_THRESHOLD,
  truncateExcerpt,
  isValidKnowledgeFactShape,
  isValidKnowledgeFactsIndexShape,
  type KnowledgeKind,
  type KnowledgeStatus,
  type KnowledgeEvidenceSource,
  type KnowledgeEvidence,
  type KnowledgeFact,
  type NewKnowledgeFact,
  type KnowledgeFactsIndexEntry,
  type KnowledgeFactsIndex,
} from './types';

export { normalizeForKey, buildCanonicalKey } from './CanonicalKeyBuilder';
export type { IKnowledgeFactsStore } from './KnowledgeFactsStore';
export { JsonKnowledgeFactsStore } from './JsonKnowledgeFactsStore';
export { initialStatusFor } from './KnowledgeFactClassifier';
export { detectContradiction } from './ContradictionDetector';
