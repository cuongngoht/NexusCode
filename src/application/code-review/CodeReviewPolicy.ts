import type { CodeReviewFinding } from './CodeReviewFinding';
import type { CodeReviewReport, CodeReviewVerdict } from './CodeReviewReport';
import { SEVERITY_ORDER, isValidSeverity } from './CodeReviewSeverity';
import { isValidCategory } from './CodeReviewCategory';
import type { CodeReviewSeverity } from './CodeReviewSeverity';

let _idCounter = 0;

function stableId(finding: Partial<CodeReviewFinding>): string {
  if (finding.id) return finding.id;
  const base = [
    finding.filePath ?? '',
    finding.lineStart ?? '',
    finding.title ?? '',
    finding.severity ?? '',
  ].join('|');
  // simple stable hash for dedup
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (Math.imul(31, hash) + base.charCodeAt(i)) | 0;
  }
  return `finding-${(hash >>> 0).toString(16)}-${++_idCounter}`;
}

export class CodeReviewPolicy {
  clampConfidence(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) return 0.7;
    return Math.max(0, Math.min(1, value));
  }

  isBlockingFinding(finding: CodeReviewFinding): boolean {
    const { severity, category } = finding;
    if (severity === 'blocker' || severity === 'critical') return true;
    // Security major or above
    if (category === 'security' && (severity === 'major' || SEVERITY_ORDER[severity] <= SEVERITY_ORDER['major'])) return true;
    // Style-only issues never block
    if (category === 'style') return false;
    return false;
  }

  calculateVerdict(findings: CodeReviewFinding[]): CodeReviewVerdict {
    if (findings.length === 0) return 'approve';
    const hasBlocking = findings.some(f => f.blocking);
    if (hasBlocking) return 'request-changes';
    const hasNonTrivial = findings.some(f => f.severity !== 'nit' && f.severity !== 'info');
    if (hasNonTrivial) return 'approve-with-comments';
    return 'approve';
  }

  calculateStats(findings: CodeReviewFinding[]): CodeReviewReport['stats'] {
    const stats: CodeReviewReport['stats'] = {
      totalFindings: findings.length,
      blocker: 0, critical: 0, major: 0, minor: 0, nit: 0, info: 0,
      architecture: 0, security: 0, test: 0, maintainability: 0,
    };
    for (const f of findings) {
      if (f.severity in stats) {
        (stats as Record<string, number>)[f.severity]++;
      }
      const archCategories = new Set(['architecture', 'oop', 'ood', 'design-pattern', 'coupling', 'cohesion', 'dependency-direction', 'abstraction', 'complexity', 'technical-debt']);
      if (archCategories.has(f.category)) stats.architecture++;
      if (f.category === 'security') stats.security++;
      if (f.category === 'test') stats.test++;
      if (f.category === 'maintainability') stats.maintainability++;
    }
    return stats;
  }

  sortFindings(findings: CodeReviewFinding[]): CodeReviewFinding[] {
    return [...findings].sort((a, b) => {
      const sa = SEVERITY_ORDER[a.severity] ?? 99;
      const sb = SEVERITY_ORDER[b.severity] ?? 99;
      if (sa !== sb) return sa - sb;
      // Secondary: blocking first
      if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
      // Tertiary: by file path
      return (a.filePath ?? '').localeCompare(b.filePath ?? '');
    });
  }

  dedupeFindings(findings: CodeReviewFinding[]): CodeReviewFinding[] {
    const seen = new Set<string>();
    const result: CodeReviewFinding[] = [];
    for (const f of findings) {
      const key = [f.filePath ?? '', f.lineStart ?? '', f.title, f.severity].join('|');
      if (!seen.has(key)) {
        seen.add(key);
        result.push(f);
      }
    }
    return result;
  }

  normalizeFinding(finding: Partial<CodeReviewFinding>): CodeReviewFinding {
    const severity: CodeReviewSeverity = isValidSeverity(finding.severity) ? finding.severity : 'info';
    const category = isValidCategory(finding.category) ? finding.category : 'maintainability';
    const confidence = this.clampConfidence(finding.confidence ?? 0.7);

    const normalized: CodeReviewFinding = {
      id: stableId(finding),
      severity,
      category,
      title: finding.title ?? 'Unnamed finding',
      description: finding.description ?? '',
      recommendation: finding.recommendation ?? 'No recommendation provided.',
      confidence,
      blocking: false,
    };

    // Copy optional fields
    if (finding.filePath !== undefined) normalized.filePath = finding.filePath;
    if (finding.lineStart !== undefined) normalized.lineStart = finding.lineStart;
    if (finding.lineEnd !== undefined) normalized.lineEnd = finding.lineEnd;
    if (finding.evidence !== undefined) normalized.evidence = finding.evidence;
    if (finding.suggestedPatch !== undefined) normalized.suggestedPatch = finding.suggestedPatch;
    if (finding.violatedPrinciple !== undefined) normalized.violatedPrinciple = finding.violatedPrinciple;
    if (finding.whyItMatters !== undefined) normalized.whyItMatters = finding.whyItMatters;
    if (finding.refactorRecommendation !== undefined) normalized.refactorRecommendation = finding.refactorRecommendation;
    if (finding.suggestedPattern !== undefined) normalized.suggestedPattern = finding.suggestedPattern;
    if (finding.migrationRisk !== undefined) normalized.migrationRisk = finding.migrationRisk;
    if (finding.priority !== undefined) normalized.priority = finding.priority;

    // Recalculate blocking based on policy
    normalized.blocking = finding.blocking !== undefined ? Boolean(finding.blocking) : this.isBlockingFinding(normalized);

    return normalized;
  }
}
