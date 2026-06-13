import { describe, it, expect } from 'vitest';
import { bm25Score } from '../bm25/Bm25Scorer';
import { DEFAULT_BM25_CONFIG } from '../bm25/Bm25Types';

describe('bm25Score', () => {
  it('returns 0 when totalDocs is 0', () => {
    const score = bm25Score(1, 10, 10, 1, 0, DEFAULT_BM25_CONFIG);
    expect(score).toBe(0);
  });

  it('returns 0 when docFreq is 0', () => {
    const score = bm25Score(1, 10, 10, 0, 100, DEFAULT_BM25_CONFIG);
    expect(score).toBe(0);
  });

  it('higher term frequency yields higher score (diminishing returns)', () => {
    const base = DEFAULT_BM25_CONFIG;
    const score1 = bm25Score(1, 100, 100, 10, 1000, base);
    const score5 = bm25Score(5, 100, 100, 10, 1000, base);
    const score10 = bm25Score(10, 100, 100, 10, 1000, base);
    expect(score5).toBeGreaterThan(score1);
    expect(score10).toBeGreaterThan(score5);
    // Diminishing returns: 5x freq should not give 5x score
    expect(score5 / score1).toBeLessThan(5);
  });

  it('shorter document gets higher score than longer for same term frequency (b normalization)', () => {
    const base = DEFAULT_BM25_CONFIG;
    const avgLen = 100;
    const scoreShort = bm25Score(2, 20, avgLen, 10, 1000, base);
    const scoreLong = bm25Score(2, 200, avgLen, 10, 1000, base);
    expect(scoreShort).toBeGreaterThan(scoreLong);
  });

  it('rare term (low docFreq) gets higher IDF than common term', () => {
    const base = DEFAULT_BM25_CONFIG;
    const scoreRare = bm25Score(1, 100, 100, 2, 1000, base);
    const scoreCommon = bm25Score(1, 100, 100, 500, 1000, base);
    expect(scoreRare).toBeGreaterThan(scoreCommon);
  });

  it('returns a positive score for a matching term', () => {
    const score = bm25Score(3, 80, 100, 15, 500, DEFAULT_BM25_CONFIG);
    expect(score).toBeGreaterThan(0);
  });

  it('score is deterministic for same inputs', () => {
    const s1 = bm25Score(2, 50, 80, 5, 200, DEFAULT_BM25_CONFIG);
    const s2 = bm25Score(2, 50, 80, 5, 200, DEFAULT_BM25_CONFIG);
    expect(s1).toBe(s2);
  });
});
