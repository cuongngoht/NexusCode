export type CodeReviewSeverity =
  | 'blocker'
  | 'critical'
  | 'major'
  | 'minor'
  | 'nit'
  | 'info';

export const SEVERITY_ORDER: Record<CodeReviewSeverity, number> = {
  blocker:  0,
  critical: 1,
  major:    2,
  minor:    3,
  nit:      4,
  info:     5,
};

export const VALID_SEVERITIES: ReadonlySet<CodeReviewSeverity> = new Set([
  'blocker', 'critical', 'major', 'minor', 'nit', 'info',
]);

export function isValidSeverity(value: unknown): value is CodeReviewSeverity {
  return typeof value === 'string' && VALID_SEVERITIES.has(value as CodeReviewSeverity);
}
