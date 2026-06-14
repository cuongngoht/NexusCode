import type { AgentSession } from './AgentSession';

export interface AgentReviewFinding {
  severity: 'info' | 'warning' | 'error';
  category: 'bug' | 'security' | 'test' | 'docs' | 'maintainability' | 'scope';
  file?: string;
  message: string;
  suggestion?: string;
}

export interface AgentReviewResult {
  sessionId: string;
  passed: boolean;
  summary: string;
  findings: AgentReviewFinding[];
}

export type RunReviewAgentFn = (
  prompt: string,
  workspaceRoot: string,
  providerId: string,
  model?: string,
) => Promise<string>;

export type CollectDiffForReviewFn = (session: AgentSession) => Promise<{ diff: string; diffStat: string }>;

export class AgentReviewRunner {
  constructor(
    private readonly runAgent: RunReviewAgentFn,
    private readonly collectDiff: CollectDiffForReviewFn,
  ) {}

  async review(session: AgentSession): Promise<AgentReviewResult> {
    let diffContext = '';
    let diffStat = '';
    try {
      const result = await this.collectDiff(session);
      diffContext = result.diff.slice(0, 8000);
      diffStat = result.diffStat;
    } catch {
      diffContext = '(diff not available)';
    }

    const reviewPrompt = buildReviewPrompt({
      originalPrompt: session.originalPrompt,
      planText: session.planText ?? '',
      diff: diffContext,
      diffStat,
    });

    let rawOutput = '';
    try {
      rawOutput = await this.runAgent(reviewPrompt, session.workspaceRoot, session.providerId, session.model);
    } catch (err) {
      return {
        sessionId: session.id,
        passed: false,
        summary: `Review failed: ${String(err)}`,
        findings: [{
          severity: 'error',
          category: 'bug',
          message: `Review agent failed: ${String(err)}`,
        }],
      };
    }

    return parseReviewOutput(session.id, rawOutput);
  }
}

function buildReviewPrompt(params: {
  originalPrompt: string;
  planText: string;
  diff: string;
  diffStat: string;
}): string {
  return `You are Nexus Agent Mode Reviewer.

Original task:
${params.originalPrompt}

Approved plan:
${params.planText}

Diff stat:
${params.diffStat}

Final diff:
${params.diff}

Review the final diff for:
- bugs
- regressions
- security issues
- type safety problems
- test coverage gaps
- docs impact
- unnecessary changes
- scope creep
- violation of project rules

Return your review as:

SUMMARY:
(1-2 sentence summary of the overall review)

FINDINGS:
Each finding on a separate line in format:
[SEVERITY] [CATEGORY] (optional: FILE:path) MESSAGE | SUGGESTION

Where:
- SEVERITY: ERROR, WARNING, or INFO
- CATEGORY: BUG, SECURITY, TEST, DOCS, MAINTAINABILITY, or SCOPE

Example:
[ERROR] [BUG] FILE:src/foo.ts Null pointer dereference on line 42 | Add null check before accessing .value

Do not edit files. Do not run commands. Only review.`;
}

function parseReviewOutput(sessionId: string, raw: string): AgentReviewResult {
  const findings: AgentReviewFinding[] = [];
  let summary = '';

  const summaryMatch = raw.match(/SUMMARY:\s*\n([\s\S]*?)(?=FINDINGS:|$)/i);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  }

  const findingsSection = raw.match(/FINDINGS:\s*\n([\s\S]*?)$/i);
  if (findingsSection) {
    const lines = findingsSection[1].split('\n');
    for (const line of lines) {
      const m = line.match(/\[(ERROR|WARNING|INFO)\]\s*\[(BUG|SECURITY|TEST|DOCS|MAINTAINABILITY|SCOPE)\](?:\s+FILE:(\S+))?\s+([^|]+)(?:\|\s*(.+))?/i);
      if (!m) continue;
      findings.push({
        severity: m[1].toLowerCase() as AgentReviewFinding['severity'],
        category: m[2].toLowerCase() as AgentReviewFinding['category'],
        file: m[3] ?? undefined,
        message: m[4].trim(),
        suggestion: m[5]?.trim() ?? undefined,
      });
    }
  }

  if (!summary) {
    summary = raw.slice(0, 300).trim() || 'Review completed.';
  }

  const passed = !findings.some(f => f.severity === 'error');
  return { sessionId, passed, summary, findings };
}
