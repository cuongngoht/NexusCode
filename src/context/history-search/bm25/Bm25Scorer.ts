import type { Bm25Config } from './Bm25Types';

/**
 * Stateless BM25 scoring function.
 *
 * @param termFreqInDoc - How many times the term appears in this document
 * @param docLength     - Number of tokens in this document
 * @param avgDocLength  - Average number of tokens across the corpus
 * @param docFreq       - How many documents contain this term
 * @param totalDocs     - Total number of documents in the corpus
 * @param cfg           - BM25 hyperparameters (k1, b)
 */
export function bm25Score(
  termFreqInDoc: number,
  docLength: number,
  avgDocLength: number,
  docFreq: number,
  totalDocs: number,
  cfg: Bm25Config,
): number {
  if (totalDocs === 0 || docFreq === 0) return 0;

  const idf = Math.log(
    (totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1,
  );

  const normDocLength = avgDocLength > 0 ? docLength / avgDocLength : 1;
  const tf =
    (termFreqInDoc * (cfg.k1 + 1)) /
    (termFreqInDoc + cfg.k1 * (1 - cfg.b + cfg.b * normDocLength));

  return idf * tf;
}
