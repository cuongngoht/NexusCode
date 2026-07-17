import { tokenize } from '../../history-search/bm25/Bm25Tokenizer';
import { CANDIDATE_CONFIDENCE_THRESHOLD, type KnowledgeFact } from '../types';
import type { FactsCorpusStats, FactsDocument, FactsSearchIndex } from './FactsDocument';

const EXCLUDED_STATUSES = new Set(['rejected', 'stale', 'superseded']);

/**
 * Excludes rejected/stale/superseded facts, and candidate facts below the confidence threshold,
 * before they ever enter the searchable corpus — not just at render time.
 */
export function isRetrievable(fact: KnowledgeFact): boolean {
  if (EXCLUDED_STATUSES.has(fact.status)) return false;
  if (fact.status === 'candidate' && fact.confidence < CANDIDATE_CONFIDENCE_THRESHOLD) return false;
  return true;
}

export class FactsIndexBuilder {
  build(facts: KnowledgeFact[]): FactsSearchIndex {
    const retrievable = facts.filter(isRetrievable);
    const documents: FactsDocument[] = retrievable.map((fact, factIndex) => {
      const content = [fact.kind, fact.subject, fact.statement].join(' ');
      return { id: fact.id, factIndex, tokens: tokenize(content) };
    });

    return {
      builtAt: Date.now(),
      documents,
      stats: this.computeStats(documents),
    };
  }

  private computeStats(documents: FactsDocument[]): FactsCorpusStats {
    const totalDocs = documents.length;
    if (totalDocs === 0) return { avgDocLength: 0, docFreq: {}, totalDocs: 0 };

    let totalTokens = 0;
    const docFreq: Record<string, number> = {};

    for (const doc of documents) {
      totalTokens += doc.tokens.length;
      const seen = new Set<string>();
      for (const token of doc.tokens) {
        if (!seen.has(token)) {
          seen.add(token);
          docFreq[token] = (docFreq[token] ?? 0) + 1;
        }
      }
    }

    return { avgDocLength: totalTokens / totalDocs, docFreq, totalDocs };
  }
}
