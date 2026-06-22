import { describe, it, expect } from 'vitest';
import { CodeReviewResultParser } from './CodeReviewResultParser';
import type { CodeReviewTarget } from './CodeReviewTarget';

const parser = new CodeReviewResultParser();
const target: CodeReviewTarget = { type: 'branch', baseBranch: 'main' };

const validJson = {
  summary: 'Looks good overall.',
  verdict: 'approve-with-comments',
  architectureSummary: 'Architecture is acceptable.',
  architectureVerdict: 'acceptable-with-debt',
  architectureScore: {
    overall: 78, coupling: 75, cohesion: 80, abstraction: 72,
    testability: 85, extensibility: 76, readability: 82,
    riskLevel: 'medium',
  },
  findings: [
    {
      severity: 'major',
      category: 'architecture',
      title: 'God class detected',
      description: 'RunTaskHandler has too many responsibilities.',
      evidence: 'File has 600+ lines and 12 injected dependencies.',
      recommendation: 'Split into smaller handlers.',
      confidence: 0.9,
      blocking: false,
      whyItMatters: 'Large classes are hard to test and extend.',
      violatedPrinciple: 'Single Responsibility Principle',
    },
  ],
};

describe('CodeReviewResultParser', () => {
  it('parses pure JSON', () => {
    const report = parser.parse(JSON.stringify(validJson), target);
    expect(report.summary).toBe('Looks good overall.');
    expect(report.verdict).toBe('approve-with-comments');
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].title).toBe('God class detected');
  });

  it('parses fenced json block', () => {
    const raw = '```json\n' + JSON.stringify(validJson) + '\n```';
    const report = parser.parse(raw, target);
    expect(report.findings).toHaveLength(1);
  });

  it('parses JSON embedded in markdown', () => {
    const raw = '# Review\n\nHere are the findings:\n\n' + JSON.stringify(validJson) + '\n\nSome trailing text.';
    const report = parser.parse(raw, target);
    expect(report.summary).toBe('Looks good overall.');
  });

  it('parses JSON followed by trailing code block containing braces (Codex-style output)', () => {
    const trailing = '\n\nHere is a suggestion:\n```ts\nfunction foo() {\n  return bar();\n}\n```';
    const raw = JSON.stringify(validJson) + trailing;
    const report = parser.parse(raw, target);
    expect(report.summary).toBe('Looks good overall.');
    expect(report.findings).toHaveLength(1);
  });

  it('parses fenced json block followed by trailing prose with braces', () => {
    const trailing = '\n\nNote: use `{ strict: true }` for safety.';
    const raw = '```json\n' + JSON.stringify(validJson) + '\n```' + trailing;
    const report = parser.parse(raw, target);
    expect(report.summary).toBe('Looks good overall.');
  });

  it('invalid JSON does not crash — returns fallback report', () => {
    const raw = 'This is not JSON at all.';
    const report = parser.parse(raw, target);
    expect(report).toBeDefined();
    expect(report.verdict).toBe('approve-with-comments');
    expect(report.findings.length).toBeGreaterThanOrEqual(1);
    expect(report.findings[0].title).toBe('Structured review parsing failed');
  });

  it('markdown-only output uses narrative summary without parse-failed finding', () => {
    const raw = '# Code Review\n\n## Findings\n\n- Major issue in foo.ts\n- Minor style issue in bar.ts';
    const report = parser.parse(raw, target);
    expect(report.verdict).toBe('approve-with-comments');
    expect(report.findings).toHaveLength(0);
    expect(report.summary).toContain('Code Review');
  });

  it('detects Grok session limit and returns blocking finding', () => {
    const raw = "You've hit your session limit · resets 2:20pm (Asia/Saigon)";
    const report = parser.parse(raw, target);
    expect(report.verdict).toBe('request-changes');
    expect(report.findings[0].title).toBe('Grok session limit reached');
    expect(report.findings[0].blocking).toBe(true);
  });

  it('confidence is clamped to 0-1', () => {
    const json = { ...validJson, findings: [{ ...validJson.findings[0], confidence: 1.9 }] };
    const report = parser.parse(JSON.stringify(json), target);
    expect(report.findings[0].confidence).toBeLessThanOrEqual(1);
  });

  it('architecture score is clamped 0-100', () => {
    const json = { ...validJson, architectureScore: { ...validJson.architectureScore, overall: 150 } };
    const report = parser.parse(JSON.stringify(json), target);
    expect(report.architectureScore!.overall).toBe(100);
  });

  it('findings without severity default to info', () => {
    const json = { ...validJson, findings: [{ title: 'No severity', description: 'test', recommendation: 'fix' }] };
    const report = parser.parse(JSON.stringify(json), target);
    expect(report.findings[0].severity).toBe('info');
  });

  it('generatedAt is a recent timestamp', () => {
    const report = parser.parse(JSON.stringify(validJson), target);
    expect(report.generatedAt).toBeGreaterThan(Date.now() - 5000);
  });

  it('suggestedPattern is optional — no crash when missing', () => {
    const findingWithoutPattern = { ...validJson.findings[0] };
    delete (findingWithoutPattern as Partial<typeof findingWithoutPattern>).suggestedPattern;
    const json = { ...validJson, findings: [findingWithoutPattern] };
    const report = parser.parse(JSON.stringify(json), target);
    expect(report.findings[0].suggestedPattern).toBeUndefined();
  });

  it('empty findings returns approve verdict', () => {
    const json = { ...validJson, findings: [], verdict: undefined };
    const report = parser.parse(JSON.stringify(json), target);
    expect(report.verdict).toBe('approve');
  });
});
