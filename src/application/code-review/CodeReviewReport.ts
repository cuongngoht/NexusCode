import type { CodeReviewFinding } from './CodeReviewFinding';
import type { CodeReviewTarget } from './CodeReviewTarget';
import type { ArchitectureScore, ArchitectureVerdict } from './CodeReviewArchitectureScore';

export type CodeReviewVerdict =
  | 'approve'
  | 'approve-with-comments'
  | 'request-changes';

export interface CodeReviewReport {
  id: string;
  target: CodeReviewTarget;
  baseBranch?: string;
  compareBranch?: string;
  summary: string;
  verdict: CodeReviewVerdict;
  architectureSummary?: string;
  architectureVerdict?: ArchitectureVerdict;
  architectureScore?: ArchitectureScore;
  findings: CodeReviewFinding[];
  changedFiles: {
    path: string;
    status: string;
    additions?: number;
    deletions?: number;
  }[];
  stats: {
    totalFindings: number;
    blocker: number;
    critical: number;
    major: number;
    minor: number;
    nit: number;
    info: number;
    architecture: number;
    security: number;
    test: number;
    maintainability: number;
  };
  generatedAt: number;
}
