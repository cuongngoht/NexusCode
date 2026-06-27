import * as crypto from 'crypto';
import type { CodeReviewFinding } from '../../application/code-review/CodeReviewFinding';

export interface FindingFingerprint {
  fingerprint: string;
  title: string;
  filePath?: string;
}

export function generateFingerprint(finding: CodeReviewFinding): string {
  const key = `${finding.filePath ?? ''}::${finding.lineStart ?? 0}::${finding.title}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}
