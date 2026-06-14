import type { CodeReviewFinding } from './CodeReviewFinding';
import type { ArchitectureScore, ArchitectureVerdict } from './CodeReviewArchitectureScore';
import { SEVERITY_ORDER } from './CodeReviewSeverity';

export const ARCHITECTURE_CATEGORIES: ReadonlySet<string> = new Set([
  'architecture', 'oop', 'ood', 'design-pattern',
  'coupling', 'cohesion', 'dependency-direction',
  'abstraction', 'complexity', 'technical-debt',
]);

export class CodeReviewArchitecturePolicy {
  isArchitectureCategory(category: string): boolean {
    return ARCHITECTURE_CATEGORIES.has(category);
  }

  shouldBlockMerge(finding: CodeReviewFinding): boolean {
    if (!this.isArchitectureCategory(finding.category)) return false;
    if (finding.category === 'style') return false;

    // Block on blocker severity
    if (finding.severity === 'blocker') return true;

    // Block on critical architecture violations
    if (finding.severity === 'critical') return true;

    // Major layer violations or circular deps block
    if (finding.severity === 'major' && finding.category === 'dependency-direction') return true;
    if (finding.severity === 'major' && finding.category === 'architecture') {
      // Only block if the finding description indicates a serious layer violation
      const desc = (finding.description + (finding.evidence ?? '')).toLowerCase();
      const serious = [
        'layer violation', 'circular dependency', 'business logic in ui',
        'business logic inside ui', 'wrong layer', 'domain import',
        'circular dep', 'public api break',
      ];
      return serious.some(kw => desc.includes(kw));
    }

    return false;
  }

  validateArchitectureFinding(finding: CodeReviewFinding): boolean {
    if (!this.isArchitectureCategory(finding.category)) return true;
    // Architecture findings should have evidence
    if (!finding.evidence && !finding.description) return false;
    // Must have some form of recommendation
    if (!finding.recommendation && !finding.refactorRecommendation) return false;
    return true;
  }

  calculateArchitectureVerdict(
    findings: CodeReviewFinding[],
    score?: ArchitectureScore,
    blockBelowScore?: number,
    warnBelowScore?: number,
  ): ArchitectureVerdict {
    const effectiveBlockBelow = blockBelowScore ?? 50;
    const effectiveWarnBelow = warnBelowScore ?? 70;

    const archFindings = findings.filter(f => this.isArchitectureCategory(f.category));
    const hasBlocker = archFindings.some(f =>
      f.severity === 'blocker' || f.severity === 'critical' || this.shouldBlockMerge(f),
    );

    if (hasBlocker) return 'architecture-blocker';

    if (score) {
      const clamped = this.clampArchitectureScore(score);
      if (clamped.overall < effectiveBlockBelow) return 'architecture-blocker';
      if (clamped.overall < effectiveWarnBelow) return 'needs-refactor';
      if (clamped.overall < 85) return 'acceptable-with-debt';
    }

    const hasMajor = archFindings.some(f => SEVERITY_ORDER[f.severity] <= SEVERITY_ORDER['major']);
    if (hasMajor) return 'needs-refactor';

    const hasMinor = archFindings.some(f => f.severity === 'minor');
    if (hasMinor) return 'acceptable-with-debt';

    return 'healthy';
  }

  clampScore(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  clampArchitectureScore(score: ArchitectureScore): ArchitectureScore {
    return {
      overall:      this.clampScore(score.overall),
      coupling:     this.clampScore(score.coupling),
      cohesion:     this.clampScore(score.cohesion),
      abstraction:  this.clampScore(score.abstraction),
      testability:  this.clampScore(score.testability),
      extensibility: this.clampScore(score.extensibility),
      readability:  this.clampScore(score.readability),
      riskLevel:    ['low', 'medium', 'high'].includes(score.riskLevel) ? score.riskLevel : 'medium',
    };
  }
}
