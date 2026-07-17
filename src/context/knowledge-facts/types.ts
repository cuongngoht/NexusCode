export const KNOWLEDGE_FACT_SCHEMA_VERSION = 'knowledge-fact-v1';
export const KNOWLEDGE_FACTS_DIR = '.nexus/knowledge-base/facts';
export const KNOWLEDGE_FACTS_INDEX_FILE = `${KNOWLEDGE_FACTS_DIR}/index.json`;

export type KnowledgeKind =
  | 'architecture' | 'module' | 'symbol' | 'contract'
  | 'invariant' | 'decision' | 'risk' | 'workflow' | 'test' | 'lesson';

export type KnowledgeStatus = 'candidate' | 'verified' | 'rejected' | 'stale' | 'superseded';

export type KnowledgeEvidenceSource = 'task' | 'file' | 'test' | 'git' | 'review' | 'debug' | 'ai';

export interface KnowledgeEvidence {
  source: KnowledgeEvidenceSource;
  /** Present when source is task/review/debug — the task that observed this evidence. */
  taskId?: string;
  /** Present when evidence is tied to a specific file. */
  filePath?: string;
  /** sha256 of filePath's content at capture time — re-hashed to detect staleness. */
  contentHash?: string;
  gitCommitSha?: string;
  testCommand?: string;
  timestamp: number;
  /** Redacted before persist — max 300 chars. */
  excerpt: string;
  observedBy: 'deterministic' | 'ai';
}

export interface KnowledgeFact {
  version: 1;
  schemaVersion: typeof KNOWLEDGE_FACT_SCHEMA_VERSION;
  id: string;
  /** sha256(kind + subject.norm + statement.norm).slice(0,16) — see CanonicalKeyBuilder. */
  canonicalKey: string;
  kind: KnowledgeKind;
  subject: string;
  statement: string;
  confidence: number;
  status: KnowledgeStatus;
  /** Append-only, capped by RetentionSweepUseCase. */
  evidence: KnowledgeEvidence[];
  /** Canonical keys of facts this fact's newest evidence conflicts with. */
  contradicts?: string[];
  /** Set only when status becomes 'superseded' — id of the fact that replaced this one. */
  supersededBy?: string;
  /** Set when a contradiction against a verified fact needs human resolution. */
  reviewRequested?: boolean;
  createdAt: number;
  updatedAt: number;
  /** Set the moment status transitions candidate -> verified. */
  verifiedAt?: number;
  workspaceRoot: string;
}

export type NewKnowledgeFact = Omit<
  KnowledgeFact,
  'version' | 'schemaVersion' | 'id' | 'canonicalKey' | 'createdAt' | 'updatedAt' | 'workspaceRoot'
>;

export interface KnowledgeFactsIndexEntry {
  id: string;
  canonicalKey: string;
  kind: KnowledgeKind;
  status: KnowledgeStatus;
  updatedAt: number;
}

export interface KnowledgeFactsIndex {
  version: 1;
  updatedAt: number;
  facts: KnowledgeFactsIndexEntry[];
}

/** Candidate facts below this confidence are excluded entirely from retrieval, not just labeled. */
export const CANDIDATE_CONFIDENCE_THRESHOLD = 0.65;

const MAX_EXCERPT_CHARS = 300;

export function truncateExcerpt(excerpt: string): string {
  return excerpt.length > MAX_EXCERPT_CHARS ? excerpt.slice(0, MAX_EXCERPT_CHARS) : excerpt;
}

export function isValidKnowledgeFactShape(value: unknown): value is KnowledgeFact {
  if (!value || typeof value !== 'object') return false;
  const f = value as Record<string, unknown>;
  return (
    f['version'] === 1 &&
    f['schemaVersion'] === KNOWLEDGE_FACT_SCHEMA_VERSION &&
    typeof f['id'] === 'string' &&
    typeof f['canonicalKey'] === 'string' &&
    typeof f['kind'] === 'string' &&
    typeof f['subject'] === 'string' &&
    typeof f['statement'] === 'string' &&
    typeof f['status'] === 'string' &&
    Array.isArray(f['evidence'])
  );
}

export function isValidKnowledgeFactsIndexShape(value: unknown): value is KnowledgeFactsIndex {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v['version'] === 1 && Array.isArray(v['facts']);
}
