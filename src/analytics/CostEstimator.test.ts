import { describe, it, expect } from 'vitest';
import { CostEstimator } from './CostEstimator';

const estimator = new CostEstimator();

describe('CostEstimator', () => {
  it('returns zero cost for zero tokens', () => {
    const result = estimator.estimate('claude', 'claude-sonnet', 0, 0);
    expect(result.estimatedInputCostUsd).toBe(0);
    expect(result.estimatedOutputCostUsd).toBe(0);
    expect(result.estimatedTotalCostUsd).toBe(0);
  });

  it('estimates claude-sonnet pricing correctly', () => {
    // claude-sonnet: input $3/1M, output $15/1M
    const result = estimator.estimate('claude', 'claude-sonnet', 1_000_000, 1_000_000);
    expect(result.estimatedInputCostUsd).toBeCloseTo(3.0, 2);
    expect(result.estimatedOutputCostUsd).toBeCloseTo(15.0, 2);
    expect(result.estimatedTotalCostUsd).toBeCloseTo(18.0, 2);
  });

  it('estimates claude-haiku pricing correctly', () => {
    // claude-haiku: input $0.8/1M, output $4/1M
    const result = estimator.estimate('claude', 'claude-haiku', 1_000_000, 1_000_000);
    expect(result.estimatedInputCostUsd).toBeCloseTo(0.8, 2);
    expect(result.estimatedOutputCostUsd).toBeCloseTo(4.0, 2);
  });

  it('estimates gpt-4o pricing correctly', () => {
    // codex gpt-4o: input $2.5/1M, output $10/1M
    const result = estimator.estimate('codex', 'gpt-4o', 1_000_000, 1_000_000);
    expect(result.estimatedInputCostUsd).toBeCloseTo(2.5, 2);
    expect(result.estimatedOutputCostUsd).toBeCloseTo(10.0, 2);
  });

  it('uses provider fallback when model is unknown', () => {
    const result = estimator.estimate('claude', undefined, 1_000, 1_000);
    // Claude fallback: input $3/1M, output $15/1M
    expect(result.estimatedInputCostUsd).toBeGreaterThan(0);
    expect(result.estimatedTotalCostUsd).toBeGreaterThan(result.estimatedInputCostUsd);
  });

  it('uses global fallback for unknown provider', () => {
    const result = estimator.estimate('unknown-provider', undefined, 1_000, 1_000);
    expect(result.estimatedTotalCostUsd).toBeGreaterThan(0);
  });

  it('total cost = input + output cost', () => {
    const result = estimator.estimate('codex', 'gpt-4o', 500, 1_000);
    expect(result.estimatedTotalCostUsd).toBeCloseTo(
      result.estimatedInputCostUsd + result.estimatedOutputCostUsd,
      10,
    );
  });
});
