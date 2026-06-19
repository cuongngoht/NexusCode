import type { AgentMetadata } from '../agents/AgentMetadata';

export interface ReviewAgentClassification {
  isReviewCapable: boolean;
  confidence: 'explicit' | 'inferred' | 'none';
  reasons: string[];
}

const EXPLICIT_PURPOSES = new Set([
  'code_review',
  'security_review',
  'architecture_review',
  'test_review',
]);

const EXPLICIT_CAPABILITIES = new Set([
  'code_review',
  'diff_analysis',
  'security_audit',
  'architecture_review',
]);

const STRONG_SIGNALS = [
  'code review',
  'reviews code changes',
  'review code changes',
  'review before merge',
  'before merge',
  'pull request review',
  'pr review',
  'diff review',
  'security audit',
  'architecture review',
  'correctness, readability, architecture',
  'security, performance',
  'evaluate the proposed changes',
  'evaluate changes',
  'reviewing code',
  'reviews changes',
  'review the changes',
  'reviewing changes',
];

// Compound patterns checked against the agent's id + name + displayName.
// Add any pattern here to make a naming convention auto-qualify as review-capable.
const ID_COMPOUND_PATTERNS: RegExp[] = [
  // review variants
  /code.?review/i,        // code-reviewer, code-reviewer-1, code_review
  /review.?code/i,        // review-code
  /arch.?review/i,        // architecture-review, arch-reviewer
  /test.?review/i,        // test-reviewer
  /pr.?review/i,          // pr-review, pr-reviewer
  /peer.?review/i,        // peer-reviewer
  /review.?er/i,          // reviewer (any prefix)
  /\breview\b/i,          // standalone: "review", "my-review", "project-review"

  // audit variants
  /security.?audit/i,     // security-auditor, security-audit
  /code.?audit/i,         // code-auditor, code-audit
  /audit.?or/i,           // auditor
  /\baudit\b/i,           // standalone: "audit", "my-audit"

  // inspect / quality variants
  /code.?inspect/i,       // code-inspector
  /inspect.?or/i,         // inspector
  /quality.?check/i,      // quality-checker
  /code.?quality/i,       // code-quality

  // explicit purpose-like names customers commonly use
  /\bchecker\b/i,         // checker (code-checker, style-checker)
  /\blinter\b/i,          // linter
  /\bscanner\b/i,         // security-scanner, vuln-scanner
];

export interface ClassifyOptions {
  /** When false, skip inference from name/description (only explicit purpose/capabilities count). */
  allowInference?: boolean;
}

export function classifyReviewAgent(
  agent: AgentMetadata,
  opts: ClassifyOptions = {},
): ReviewAgentClassification {
  const { allowInference = true } = opts;
  const reasons: string[] = [];

  // Explicit purpose wins
  if (agent.purpose && EXPLICIT_PURPOSES.has(agent.purpose)) {
    reasons.push(`purpose is ${agent.purpose}`);
    return { isReviewCapable: true, confidence: 'explicit', reasons };
  }

  // Explicit capabilities
  if (agent.capabilities?.some(c => EXPLICIT_CAPABILITIES.has(c))) {
    const matched = agent.capabilities.filter(c => EXPLICIT_CAPABILITIES.has(c));
    reasons.push(`capabilities include ${matched.join(', ')}`);
    return { isReviewCapable: true, confidence: 'explicit', reasons };
  }

  // Inferred from name/description (skipped when allowInference is false)
  if (allowInference) {
    // 1. Compound pattern in agent ID/name (e.g. 'code-reviewer-1' contains 'code-review')
    const idAndName = [(agent.id ?? ''), (agent.name ?? ''), (agent.displayName ?? '')].join(' ');
    if (ID_COMPOUND_PATTERNS.some(p => p.test(idAndName))) {
      reasons.push(`compound review pattern in agent id: ${agent.id}`);
      return { isReviewCapable: true, confidence: 'inferred', reasons };
    }

    // 2. Strong signals in description/display text
    const nameAndDesc = [
      (agent.name ?? '').toLowerCase(),
      (agent.displayName ?? '').toLowerCase(),
      (agent.description ?? '').toLowerCase(),
    ].join(' ');

    const matchedSignals = STRONG_SIGNALS.filter(s => nameAndDesc.includes(s));
    if (matchedSignals.length > 0) {
      reasons.push(`strong signals in name/description: ${matchedSignals.slice(0, 2).join(', ')}`);
      return { isReviewCapable: true, confidence: 'inferred', reasons };
    }
  }

  reasons.push('no review signals found');
  return { isReviewCapable: false, confidence: 'none', reasons };
}
