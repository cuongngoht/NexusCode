import { parseUnifiedDiff } from '../../git/structuredDiff';
import type { RiskScore, RiskLevel } from './RiskScoreTypes';

export function scoreRisk(diff: string, changedFiles: Array<{ path: string }>): RiskScore {
  const factors: string[] = [];
  let score = 0;

  // Lines changed
  const parsed = parseUnifiedDiff(diff);
  const totalLines = parsed.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  if (totalLines > 500) { score += 25; factors.push(`Large change: ${totalLines} lines`); }
  else if (totalLines > 200) { score += 15; factors.push(`Medium change: ${totalLines} lines`); }
  else if (totalLines > 50) { score += 5; factors.push(`Minor change: ${totalLines} lines`); }

  // Security-sensitive filenames
  const securityPattern = /\.(env|pem|key|p12|pfx)$|auth|crypto|password|token|secret|jwt|credential/i;
  const securityFiles = changedFiles.filter(f => securityPattern.test(f.path));
  if (securityFiles.length > 0) {
    score += 30;
    factors.push(`Security-sensitive files: ${securityFiles.map(f => f.path).join(', ')}`);
  }

  // High-risk file types
  const highRiskPattern = /\.sql$|migration|package\.json$|tsconfig\.json$|\.config\.(js|ts|cjs|mjs)$/i;
  const highRiskFiles = changedFiles.filter(f => highRiskPattern.test(f.path));
  if (highRiskFiles.length > 0) {
    score += 20;
    factors.push(`High-risk file types: ${highRiskFiles.map(f => f.path).join(', ')}`);
  }

  // File count
  const fileCount = changedFiles.length;
  if (fileCount > 20) { score += 15; factors.push(`Many files changed: ${fileCount}`); }
  else if (fileCount > 10) { score += 10; factors.push(`Multiple files changed: ${fileCount}`); }
  else if (fileCount > 5) { score += 5; factors.push(`Several files changed: ${fileCount}`); }

  // Clamp score
  score = Math.min(100, score);

  let level: RiskLevel;
  if (score <= 25) level = 'low';
  else if (score <= 50) level = 'medium';
  else if (score <= 75) level = 'high';
  else level = 'critical';

  return { level, score, factors };
}
