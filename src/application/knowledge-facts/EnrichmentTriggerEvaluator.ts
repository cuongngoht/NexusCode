export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ReviewFindingSeverity = 'blocker' | 'critical' | 'major' | 'minor' | 'info';

export interface EnrichmentTriggerInput {
  /** "significant diff" — reuse whatever risk-scoring already exists (e.g. auto-review's RiskScoreEngine). */
  riskLevel?: RiskLevel;
  /** "debug root cause" — DebugFinding.role === 'confirmed'. */
  debugRootCauseConfirmed?: boolean;
  /** "review finding" — any CodeReviewFinding at or above major severity, or blocking. */
  reviewFindingSeverity?: ReviewFindingSeverity;
  reviewFindingBlocking?: boolean;
  /** "test failure" — FileTouchEvent.testResult.passed === false. */
  testFailed?: boolean;
  /** For the "architectural decision" heuristic — task prompt or implementation summary text. */
  promptOrSummaryText?: string;
}

export type EnrichmentTriggerReason =
  | 'significant-diff' | 'debug-root-cause' | 'review-finding' | 'test-failure' | 'architectural-decision';

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const HIGH_SEVERITY: ReviewFindingSeverity[] = ['blocker', 'critical', 'major'];

// Best-effort only — no real "architectural decision" signal exists anywhere in this codebase,
// unlike the other four triggers which are backed by a concrete, already-computed value.
const DECISION_HEURISTIC_RE = /\b(decided to|chose|instead of|migrat(?:e|ion)|replac(?:e|ing))\b/i;

/**
 * Pure decision function — no I/O, no side effects. Checks triggers in the order given in the
 * plan (significant diff, debug root cause, review finding, test failure, architectural
 * decision) and returns the first one that matches.
 */
export function evaluateEnrichmentTrigger(
  input: EnrichmentTriggerInput,
  minRiskLevel: RiskLevel = 'medium',
): EnrichmentTriggerReason | undefined {
  if (input.riskLevel && RISK_LEVEL_ORDER[input.riskLevel] >= RISK_LEVEL_ORDER[minRiskLevel]) {
    return 'significant-diff';
  }
  if (input.debugRootCauseConfirmed) {
    return 'debug-root-cause';
  }
  if (input.reviewFindingBlocking || (input.reviewFindingSeverity && HIGH_SEVERITY.includes(input.reviewFindingSeverity))) {
    return 'review-finding';
  }
  if (input.testFailed) {
    return 'test-failure';
  }
  if (input.promptOrSummaryText && DECISION_HEURISTIC_RE.test(input.promptOrSummaryText)) {
    return 'architectural-decision';
  }
  return undefined;
}
