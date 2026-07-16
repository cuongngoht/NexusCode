import type { CodeReviewReport } from '../application/code-review/CodeReviewReport';
import type { RiskScore } from './risk/RiskScoreTypes';

export interface AutoReviewReport {
  id: string;
  timestamp: number;
  workspaceRoot: string;
  watchMode: string;
  diffHash: string;
  risk: RiskScore;
  skipped: boolean;
  skipReason?: string;
  codeReview?: CodeReviewReport;
  baselineSuppressed?: number;
}

export interface AutoReviewIndexEntry {
  id: string;
  timestamp: number;
  verdict?: string;
  risk: { level: string; score: number };
  skipped: boolean;
}
