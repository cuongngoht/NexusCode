import type { CodeReviewSeverity } from './CodeReviewSeverity';
import type { CodeReviewCategory } from './CodeReviewCategory';

export interface CodeReviewFinding {
  id: string;
  severity: CodeReviewSeverity;
  category: CodeReviewCategory;
  title: string;
  description: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  evidence?: string;
  recommendation: string;
  suggestedPatch?: string;
  confidence: number;
  blocking: boolean;
  violatedPrinciple?: string;
  whyItMatters?: string;
  refactorRecommendation?: string;
  suggestedPattern?: string;
  migrationRisk?: 'low' | 'medium' | 'high';
  priority?: 'p0' | 'p1' | 'p2' | 'p3';
}
