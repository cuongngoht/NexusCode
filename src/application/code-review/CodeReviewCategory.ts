export type CodeReviewCategory =
  | 'bug'
  | 'security'
  | 'performance'
  | 'test'
  | 'maintainability'
  | 'architecture'
  | 'oop'
  | 'ood'
  | 'design-pattern'
  | 'coupling'
  | 'cohesion'
  | 'dependency-direction'
  | 'abstraction'
  | 'complexity'
  | 'technical-debt'
  | 'style'
  | 'docs'
  | 'typing'
  | 'dependency'
  | 'config'
  | 'ux';

export const VALID_CATEGORIES: ReadonlySet<CodeReviewCategory> = new Set([
  'bug', 'security', 'performance', 'test', 'maintainability',
  'architecture', 'oop', 'ood', 'design-pattern', 'coupling', 'cohesion',
  'dependency-direction', 'abstraction', 'complexity', 'technical-debt',
  'style', 'docs', 'typing', 'dependency', 'config', 'ux',
]);

export function isValidCategory(value: unknown): value is CodeReviewCategory {
  return typeof value === 'string' && VALID_CATEGORIES.has(value as CodeReviewCategory);
}
