import { normalizeForKey } from './CanonicalKeyBuilder';
import type { KnowledgeFact, KnowledgeKind } from './types';

const PASS_RE = /\bpass(ed|es|ing)?\b/i;
const FAIL_RE = /\bfail(ed|s|ing)?\b/i;

/**
 * Contradiction detection is scoped to a small set of deterministic, enumerable cases —
 * true statement-vs-statement NLI contradiction detection doesn't exist anywhere in this
 * codebase and is out of scope. Anything not covered here is treated as non-conflicting
 * (callers fall through to merge-as-corroborating).
 */
export function detectContradiction(
  existing: KnowledgeFact,
  incomingKind: KnowledgeKind,
  incomingSubject: string,
  incomingStatement: string,
): boolean {
  if (existing.kind !== incomingKind) return false;
  if (normalizeForKey(existing.subject) !== normalizeForKey(incomingSubject)) return false;
  if (normalizeForKey(existing.statement) === normalizeForKey(incomingStatement)) return false; // same fact

  if (incomingKind === 'test') {
    const existingPass = PASS_RE.test(existing.statement);
    const existingFail = FAIL_RE.test(existing.statement);
    const incomingPass = PASS_RE.test(incomingStatement);
    const incomingFail = FAIL_RE.test(incomingStatement);
    return (existingPass && incomingFail) || (existingFail && incomingPass);
  }

  if (incomingKind === 'contract') {
    // Same subject, different statement, both describing a contract — conservatively flagged
    // as a potential signature change. Confirming it against an actual git diff is deferred.
    return true;
  }

  return false;
}
