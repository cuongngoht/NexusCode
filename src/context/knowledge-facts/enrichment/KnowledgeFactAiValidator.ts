import { z } from 'zod';
import { truncateExcerpt } from '../types';
import type { KnowledgeKind } from '../types';

const KNOWLEDGE_KINDS = [
  'architecture', 'module', 'symbol', 'contract',
  'invariant', 'decision', 'risk', 'workflow', 'test', 'lesson',
] as const;

const RawFactSchema = z.object({
  kind: z.enum(KNOWLEDGE_KINDS),
  subject: z.string().min(1),
  statement: z.string().min(1),
  confidence: z.number(),
  evidenceExcerpt: z.string(),
});

const RawFactsResponseSchema = z.object({
  facts: z.array(z.unknown()),
});

export interface ValidatedAiFact {
  kind: KnowledgeKind;
  subject: string;
  statement: string;
  confidence: number;
  evidenceExcerpt: string;
}

/**
 * Validates the outer { facts: [...] } shape strictly (throws if malformed), but validates each
 * individual fact leniently — a malformed fact is dropped rather than failing the whole batch,
 * matching this codebase's "never let one bad item break retrieval" convention elsewhere
 * (e.g. KnowledgeBaseLoader skipping corrupt journal entries).
 */
export class KnowledgeFactAiValidator {
  validate(raw: unknown): ValidatedAiFact[] {
    const parsed = RawFactsResponseSchema.parse(raw);

    const validated: ValidatedAiFact[] = [];
    for (const item of parsed.facts) {
      const result = RawFactSchema.safeParse(item);
      if (!result.success) continue;
      validated.push({
        ...result.data,
        confidence: Math.max(0, Math.min(1, result.data.confidence)),
        evidenceExcerpt: truncateExcerpt(result.data.evidenceExcerpt),
      });
    }
    return validated;
  }
}
