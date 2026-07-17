import * as crypto from 'crypto';
import type { KnowledgeKind } from './types';

/**
 * Deliberately simple normalization — case/whitespace/punctuation only, no stemming or
 * semantic dedup. Two statements differing only in tense or synonym choice will get different
 * keys and will NOT dedup; true semantic matching would need an embedding model, which doesn't
 * exist anywhere in this codebase and is out of scope here.
 */
export function normalizeForKey(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.,;:!?'"()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCanonicalKey(kind: KnowledgeKind, subject: string, statement: string): string {
  const raw = `${kind}::${normalizeForKey(subject)}::${normalizeForKey(statement)}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}
