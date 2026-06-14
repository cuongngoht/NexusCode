import type { CodeReviewReport, CodeReviewVerdict } from './CodeReviewReport';
import type { CodeReviewFinding } from './CodeReviewFinding';
import type { CodeReviewTarget } from './CodeReviewTarget';
import type { ArchitectureScore, ArchitectureVerdict } from './CodeReviewArchitectureScore';
import { CodeReviewPolicy } from './CodeReviewPolicy';
import { CodeReviewArchitecturePolicy } from './CodeReviewArchitecturePolicy';
import { isValidSeverity } from './CodeReviewSeverity';
import { isValidCategory } from './CodeReviewCategory';

const VALID_VERDICTS: ReadonlySet<string> = new Set(['approve', 'approve-with-comments', 'request-changes']);
const VALID_ARCH_VERDICTS: ReadonlySet<string> = new Set(['healthy', 'acceptable-with-debt', 'needs-refactor', 'architecture-blocker']);

function generateId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extractJson(raw: string): string | null {
  // 1. Pure JSON (starts with {)
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  // 2. Fenced JSON block: ```json ... ```
  const fencedMatch = trimmed.match(/```json\s*\n([\s\S]*?)\n```/);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  // 3. Fenced block without language: ``` ... ```
  const genericFenced = trimmed.match(/```\s*\n([\s\S]*?)\n```/);
  if (genericFenced) {
    const inner = genericFenced[1].trim();
    if (inner.startsWith('{')) return inner;
  }

  // 4. JSON embedded in markdown — find first { and last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

function clampScore(v: unknown): number {
  const n = Number(v);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function parseArchitectureScore(raw: unknown): ArchitectureScore | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const policy = new CodeReviewArchitecturePolicy();
  return policy.clampArchitectureScore({
    overall:      clampScore(r.overall),
    coupling:     clampScore(r.coupling),
    cohesion:     clampScore(r.cohesion),
    abstraction:  clampScore(r.abstraction),
    testability:  clampScore(r.testability),
    extensibility: clampScore(r.extensibility),
    readability:  clampScore(r.readability),
    riskLevel:    ['low', 'medium', 'high'].includes(String(r.riskLevel)) ? r.riskLevel as 'low' | 'medium' | 'high' : 'medium',
  });
}

function parseFindings(raw: unknown, policy: CodeReviewPolicy): CodeReviewFinding[] {
  if (!Array.isArray(raw)) return [];
  const findings: CodeReviewFinding[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    try {
      const partial: Partial<CodeReviewFinding> = {
        id: typeof r.id === 'string' ? r.id : undefined,
        severity: isValidSeverity(r.severity) ? r.severity : 'info',
        category: isValidCategory(r.category) ? r.category : 'maintainability',
        title: typeof r.title === 'string' ? r.title : 'Unnamed finding',
        description: typeof r.description === 'string' ? r.description : '',
        recommendation: typeof r.recommendation === 'string' ? r.recommendation : 'No recommendation.',
        confidence: policy.clampConfidence(typeof r.confidence === 'number' ? r.confidence : 0.7),
        blocking: Boolean(r.blocking),
      };
      if (typeof r.filePath === 'string') partial.filePath = r.filePath;
      if (typeof r.lineStart === 'number') partial.lineStart = r.lineStart;
      if (typeof r.lineEnd === 'number') partial.lineEnd = r.lineEnd;
      if (typeof r.evidence === 'string') partial.evidence = r.evidence;
      if (typeof r.suggestedPatch === 'string') partial.suggestedPatch = r.suggestedPatch;
      if (typeof r.violatedPrinciple === 'string') partial.violatedPrinciple = r.violatedPrinciple;
      if (typeof r.whyItMatters === 'string') partial.whyItMatters = r.whyItMatters;
      if (typeof r.refactorRecommendation === 'string') partial.refactorRecommendation = r.refactorRecommendation;
      if (typeof r.suggestedPattern === 'string') partial.suggestedPattern = r.suggestedPattern;
      if (['low', 'medium', 'high'].includes(String(r.migrationRisk))) {
        partial.migrationRisk = r.migrationRisk as 'low' | 'medium' | 'high';
      }
      if (['p0', 'p1', 'p2', 'p3'].includes(String(r.priority))) {
        partial.priority = r.priority as 'p0' | 'p1' | 'p2' | 'p3';
      }
      findings.push(policy.normalizeFinding(partial));
    } catch {
      // skip malformed finding
    }
  }
  return findings;
}

function buildFallbackReport(
  target: CodeReviewTarget,
  rawOutput: string,
  errorMessage: string,
): CodeReviewReport {
  const policy = new CodeReviewPolicy();
  const infoFinding = policy.normalizeFinding({
    severity: 'info',
    category: 'maintainability',
    title: 'Structured review parsing failed',
    description: `The AI reviewer returned output that could not be parsed as structured JSON. ${errorMessage}`,
    recommendation: 'Review the raw output below and address any comments manually.',
    evidence: rawOutput.slice(0, 500),
    confidence: 1.0,
    blocking: false,
  });

  return {
    id: generateId(),
    target,
    summary: rawOutput.slice(0, 800).trim() || 'Review output could not be parsed.',
    verdict: 'approve-with-comments',
    findings: [infoFinding],
    changedFiles: [],
    stats: policy.calculateStats([infoFinding]),
    generatedAt: Date.now(),
  };
}

export class CodeReviewResultParser {
  parse(rawOutput: string, target: CodeReviewTarget): CodeReviewReport {
    const policy = new CodeReviewPolicy();
    const archPolicy = new CodeReviewArchitecturePolicy();

    const jsonStr = extractJson(rawOutput);
    if (!jsonStr) {
      return buildFallbackReport(target, rawOutput, 'No JSON structure found in output.');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      return buildFallbackReport(target, rawOutput, `JSON parse error: ${String(e)}`);
    }

    // Parse findings
    const rawFindings = parseFindings(parsed.findings, policy);
    const dedupedFindings = policy.dedupeFindings(rawFindings);
    const sortedFindings = policy.sortFindings(dedupedFindings);

    // Parse verdict
    const verdict: CodeReviewVerdict = VALID_VERDICTS.has(String(parsed.verdict))
      ? parsed.verdict as CodeReviewVerdict
      : policy.calculateVerdict(sortedFindings);

    // Parse architecture fields
    const architectureScore = parseArchitectureScore(parsed.architectureScore);
    const architectureVerdict: ArchitectureVerdict | undefined = VALID_ARCH_VERDICTS.has(String(parsed.architectureVerdict))
      ? parsed.architectureVerdict as ArchitectureVerdict
      : archPolicy.calculateArchitectureVerdict(sortedFindings, architectureScore);

    const stats = policy.calculateStats(sortedFindings);

    return {
      id: generateId(),
      target,
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Review completed.',
      verdict,
      architectureSummary: typeof parsed.architectureSummary === 'string' ? parsed.architectureSummary : undefined,
      architectureVerdict,
      architectureScore,
      findings: sortedFindings,
      changedFiles: [],
      stats,
      generatedAt: Date.now(),
    };
  }
}
