export interface ModelPricing {
  provider: string;
  model: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

interface CostResult {
  estimatedInputCostUsd: number;
  estimatedOutputCostUsd: number;
  estimatedTotalCostUsd: number;
}

const MODEL_PRICING: ModelPricing[] = [
  // Claude models
  { provider: 'claude', model: 'claude-opus', inputUsdPer1M: 15.0, outputUsdPer1M: 75.0 },
  { provider: 'claude', model: 'claude-opus-4', inputUsdPer1M: 15.0, outputUsdPer1M: 75.0 },
  { provider: 'claude', model: 'claude-sonnet', inputUsdPer1M: 3.0, outputUsdPer1M: 15.0 },
  { provider: 'claude', model: 'claude-sonnet-4', inputUsdPer1M: 3.0, outputUsdPer1M: 15.0 },
  { provider: 'claude', model: 'claude-3-5-sonnet', inputUsdPer1M: 3.0, outputUsdPer1M: 15.0 },
  { provider: 'claude', model: 'claude-3-5-haiku', inputUsdPer1M: 0.8, outputUsdPer1M: 4.0 },
  { provider: 'claude', model: 'claude-haiku', inputUsdPer1M: 0.8, outputUsdPer1M: 4.0 },
  // Codex / OpenAI models
  { provider: 'codex', model: 'gpt-4o', inputUsdPer1M: 2.5, outputUsdPer1M: 10.0 },
  { provider: 'codex', model: 'gpt-4o-mini', inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
  { provider: 'codex', model: 'o1', inputUsdPer1M: 15.0, outputUsdPer1M: 60.0 },
  { provider: 'codex', model: 'o3', inputUsdPer1M: 10.0, outputUsdPer1M: 40.0 },
  // Gemini / Antigravity models
  { provider: 'antigravity', model: 'gemini-2.5-pro', inputUsdPer1M: 1.25, outputUsdPer1M: 10.0 },
  { provider: 'antigravity', model: 'gemini-2.5-flash', inputUsdPer1M: 0.075, outputUsdPer1M: 0.3 },
  { provider: 'antigravity', model: 'gemini-2.0-flash', inputUsdPer1M: 0.075, outputUsdPer1M: 0.3 },
  { provider: 'antigravity', model: 'gemini-1.5-pro', inputUsdPer1M: 1.25, outputUsdPer1M: 5.0 },
  // Grok models
  { provider: 'grok', model: 'grok-3', inputUsdPer1M: 3.0, outputUsdPer1M: 15.0 },
  { provider: 'grok', model: 'grok-3-mini', inputUsdPer1M: 0.3, outputUsdPer1M: 0.5 },
];

// Fallback pricing when exact model is unknown — conservative estimates
const PROVIDER_FALLBACK: Record<string, { inputUsdPer1M: number; outputUsdPer1M: number }> = {
  claude:      { inputUsdPer1M: 3.0,   outputUsdPer1M: 15.0 },
  codex:       { inputUsdPer1M: 2.5,   outputUsdPer1M: 10.0 },
  antigravity: { inputUsdPer1M: 1.25,  outputUsdPer1M: 5.0 },
  grok:        { inputUsdPer1M: 3.0,   outputUsdPer1M: 15.0 },
  copilot:     { inputUsdPer1M: 2.0,   outputUsdPer1M: 8.0 },
  aider:       { inputUsdPer1M: 2.5,   outputUsdPer1M: 10.0 },
  custom:      { inputUsdPer1M: 2.0,   outputUsdPer1M: 8.0 },
  nexus:       { inputUsdPer1M: 3.0,   outputUsdPer1M: 15.0 },
};

const DEFAULT_FALLBACK = { inputUsdPer1M: 2.0, outputUsdPer1M: 8.0 };

export class CostEstimator {
  estimate(
    provider: string,
    model: string | undefined,
    inputTokens: number,
    outputTokens: number,
  ): CostResult {
    const pricing = this.findPricing(provider, model);
    const estimatedInputCostUsd = (inputTokens / 1_000_000) * pricing.inputUsdPer1M;
    const estimatedOutputCostUsd = (outputTokens / 1_000_000) * pricing.outputUsdPer1M;
    return {
      estimatedInputCostUsd,
      estimatedOutputCostUsd,
      estimatedTotalCostUsd: estimatedInputCostUsd + estimatedOutputCostUsd,
    };
  }

  private findPricing(
    provider: string,
    model: string | undefined,
  ): { inputUsdPer1M: number; outputUsdPer1M: number } {
    if (model) {
      const normalizedModel = model.toLowerCase();
      // Find best matching pricing entry — substring match
      const match = MODEL_PRICING.find(
        p => p.provider === provider && normalizedModel.includes(p.model.toLowerCase()),
      );
      if (match) return match;
    }

    return PROVIDER_FALLBACK[provider] ?? DEFAULT_FALLBACK;
  }
}
