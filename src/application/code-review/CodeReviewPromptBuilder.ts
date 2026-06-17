import * as fs from 'fs';
import * as path from 'path';
import type { CodeReviewContext } from './CodeReviewContextBuilder';

export type CodeReviewPreset = 'fast' | 'balanced' | 'architecture' | 'safe' | 'full';

export interface CodeReviewPromptInput {
  context: CodeReviewContext;
  userPrompt?: string;
  preset?: CodeReviewPreset;
}

const ARCHITECTURE_DIMENSIONS = `
## Architecture / OOP / OOD / Design Pattern Review

Architecture review is mandatory, but depth depends on the preset.
For the fast preset, report only architecture issues that create clear risk or blockers.

Evaluate for AI-generated code risks:
- unnecessary complexity, duplicated abstractions, premature abstractions
- under-engineering or over-engineering
- God classes, long methods, low cohesion, high coupling
- unclear ownership, wrong layer placement, weak module boundaries
- circular dependencies, unstable public APIs
- excessive conditionals based on mode/type/provider
- hard-coded provider/mode behavior
- business logic inside UI components
- infrastructure logic leaking into domain/application layers
- poor testability, unclear extension boundaries

Evaluate OOP/OOD:
- encapsulation, abstraction, cohesion, coupling
- SOLID principles, dependency inversion, interface segregation
- replaceability of implementations, testability
- object ownership, invariant protection

Evaluate design pattern usage (Strategy, Adapter, Factory, Policy, Command, Repository, Chain of Responsibility, Facade):
Do NOT recommend a design pattern unless:
1. there is a real structural problem
2. the pattern directly solves that problem
3. the resulting code becomes easier to maintain
4. the pattern does not create unnecessary complexity

Avoid:
- vague comments, formatting nitpicks, subjective preferences
- large refactor suggestions without concrete evidence
- recommending patterns just because they are popular
`.trim();

const EVIDENCE_AND_ACCURACY_RULES = `
## Evidence & Accuracy Rules

- Review only the provided diff, selected code, changed files, changed code context, and project rules.
- Focus on changed code and directly affected surrounding context.
- Mention pre-existing issues only if the change worsens them, exposes them, or depends on them.
- Do not invent files, line numbers, test results, dependencies, runtime behavior, project conventions, or historical context.
- Do not claim tests passed, failed, regressed, or were run unless explicit test execution output is provided.
- If no test execution output is provided, write: "No test execution evidence was provided."
- Every code-related finding must cite concrete evidence from the provided code or diff.
- Do not report a code finding if you cannot point to specific evidence.
- Use lineStart only when the line number is available from the provided diff/context.
- If a line number is unavailable, set lineStart to 0 and mention "line unavailable" in the evidence or description.
- Do not invent line numbers.
- Sort findings by severity and practical impact: blocker, critical, major, minor, nit, info.
- Prefer fewer high-confidence findings over many speculative findings.
- If the diff is truncated, explicitly state that the review is limited to visible hunks and provided context.
- The final JSON block must be the last content in the response. Do not write anything after the JSON block.
`.trim();

/** Used instead of OUTPUT_CONTRACT when the agent runs in non-interactive (--print) mode.
 *  Skips the narrative to guarantee the JSON block is always present and never truncated. */
const JSON_ONLY_OUTPUT_CONTRACT = `
## Output Format — JSON Only

Output ONLY the structured JSON block below. Do NOT write a narrative (Part 1).
The JSON must be the entire response — no introductory text, no trailing text.

\`\`\`json
{
  "summary": "2–4 sentence overall verdict",
  "verdict": "approve | approve-with-comments | request-changes",
  "architectureSummary": "2–3 sentence architecture-specific assessment",
  "architectureVerdict": "healthy | acceptable-with-debt | needs-refactor | architecture-blocker",
  "architectureScore": {
    "overall": 0,
    "coupling": 0,
    "cohesion": 0,
    "abstraction": 0,
    "testability": 0,
    "extensibility": 0,
    "readability": 0,
    "riskLevel": "low | medium | high"
  },
  "findings": [
    {
      "severity": "blocker | critical | major | minor | nit | info",
      "category": "bug | security | performance | test | maintainability | architecture | oop | ood | design-pattern | coupling | cohesion | dependency-direction | abstraction | complexity | technical-debt | style | docs | typing | dependency | config | ux",
      "title": "short title <=80 chars",
      "description": "1–3 sentences",
      "filePath": "relative/path/to/file.ts",
      "lineStart": 0,
      "evidence": "<=150 chars of relevant code",
      "recommendation": "1–2 sentences on how to fix",
      "confidence": 0.7,
      "blocking": false,
      "violatedPrinciple": "e.g. SRP (optional)",
      "whyItMatters": "1 sentence (required for architecture findings)"
    }
  ]
}
\`\`\`

Rules:
- Output valid JSON only. No text before or after the \`\`\`json block.
- Every finding MUST have: severity, category, title, description, filePath, lineStart, evidence, recommendation, confidence, blocking.
- Aim for 5–15 findings when evidence supports them.
- architectureScore values: integers 0–100. confidence: number 0.0–1.0.
`.trim();

const READ_ONLY_REVIEW_CONSTRAINTS = `
## Critical — read-only review

- Do **not** create, edit, or delete files. Do **not** use write/edit/apply_patch/shell tools to save the report.
- Output the structured JSON **only in your reply text** — do not write any files.
- Nexus parses your reply automatically; writing a report file (e.g. under \`.nexus/reviews/\`) will hang or fail the review flow.
`.trim();

function buildRoleSection(preset: CodeReviewPreset): string {
  const focusMap: Record<CodeReviewPreset, string> = {
    fast: 'Focus on critical bugs, security issues, and obvious blockers. Include only architecture issues with clear practical risk.',
    balanced: 'Review correctness, security, tests, maintainability, and architecture with balanced depth.',
    architecture: 'Focus primarily on architecture quality, OOP/OOD, design patterns, and long-term technical debt.',
    safe: 'Prioritize correctness, security, data loss, privacy, and production safety. Avoid speculative architecture comments unless they affect safety or maintainability.',
    full: 'Comprehensive review: correctness, regressions, security, performance, tests, maintainability, architecture, OOP/OOD, design patterns, and long-term technical debt.',
  };

  return `## Role

You are Nexus Architecture Code Reviewer.
Your task is to review AI-generated code for:
1. correctness and regressions
2. security
3. performance
4. test coverage
5. maintainability
6. architecture
7. OOP/OOD quality
8. design pattern fitness
9. long-term technical debt

${focusMap[preset]}

Architecture review is mandatory regardless of preset, but the depth of architecture analysis depends on the selected preset.`.trim();
}

export class CodeReviewPromptBuilder {
  constructor(private readonly extensionRoot?: string) {}

  private loadSection(name: string, fallback: string): string {
    if (this.extensionRoot) {
      try {
        const filePath = path.join(this.extensionRoot, 'media', 'prompts', 'modes', 'review-code', `${name}.md`);
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (content) return content;
      } catch { /* fall through to fallback */ }
    }
    return fallback;
  }

  build(input: CodeReviewPromptInput): string {
    const { context, userPrompt, preset = 'architecture' } = input;
    const { target, baseBranch, compareBranch, changedFiles, diffStat, diff, diffTruncated, changedCodeContext, projectRules } = context;

    const sections: string[] = [];

    // Role
    sections.push(buildRoleSection(preset));

    // Review target description
    const targetLines: string[] = ['## Review Target'];
    targetLines.push(`Target type: ${target.type}`);
    if (baseBranch) targetLines.push(`Base branch: ${baseBranch}`);
    if (compareBranch) targetLines.push(`Compare branch: ${compareBranch}`);
    if (target.commitSha) targetLines.push(`Commit: ${target.commitSha}`);
    if (target.filePath) targetLines.push(`File: ${target.filePath}`);
    sections.push(targetLines.join('\n'));

    // Project rules (if any)
    if (projectRules) {
      const rulesSections: string[] = ['## Project Rules'];
      if (projectRules.rules) rulesSections.push(`### General Rules\n${projectRules.rules}`);
      if (projectRules.codingStyle) rulesSections.push(`### Coding Style\n${projectRules.codingStyle}`);
      if (projectRules.testingPolicy) rulesSections.push(`### Testing Policy\n${projectRules.testingPolicy}`);
      if (projectRules.securityPolicy) rulesSections.push(`### Security Policy\n${projectRules.securityPolicy}`);
      if (projectRules.architecturePolicy) rulesSections.push(`### Architecture Policy\n${projectRules.architecturePolicy}`);
      if (projectRules.oopPolicy) rulesSections.push(`### OOP/OOD Policy\n${projectRules.oopPolicy}`);
      if (projectRules.designPatternPolicy) rulesSections.push(`### Design Pattern Policy\n${projectRules.designPatternPolicy}`);
      if (projectRules.reviewChecklist) rulesSections.push(`### Review Checklist\n${projectRules.reviewChecklist}`);
      sections.push(rulesSections.join('\n\n'));
    }

    // Changed files
    if (changedFiles.length > 0) {
      const fileLines = changedFiles.map(f =>
        `${f.status} ${f.path}${f.additions !== undefined ? ` (+${f.additions}/-${f.deletions ?? 0})` : ''}`,
      );
      sections.push(`## Changed Files\n${fileLines.join('\n')}`);
    } else {
      sections.push('## Changed Files\nNo changed files detected.');
    }

    // Diff stat
    if (diffStat) {
      sections.push(`## Diff Stat\n${diffStat}`);
    }

    // Changed code context (expanded view)
    if (changedCodeContext) {
      sections.push(`## Changed Code Context\n${changedCodeContext}`);
    }

    // Selection
    if (target.type === 'selection' && target.selectedText) {
      sections.push(`## Selected Code\n\`\`\`\n${target.selectedText}\n\`\`\``);
    }

    // Git diff
    if (diff) {
      const truncatedNote = diffTruncated
        ? '\n\n**Note:** The git diff was truncated because it exceeded the size limit. Prioritize only the visible hunks, changed file list, selected code, and provided changed code context. Do not infer findings from omitted hunks.'
        : '';
      sections.push(`## Git Diff\n\`\`\`diff\n${diff}\n\`\`\`${truncatedNote}`);
    }

    // Architecture review dimensions
    sections.push(this.loadSection('architecture-dimensions', ARCHITECTURE_DIMENSIONS));

    // Evidence and anti-hallucination rules
    sections.push(this.loadSection('evidence-accuracy-rules', EVIDENCE_AND_ACCURACY_RULES));

    // User custom prompt
    const request = userPrompt?.trim() ||
      'Review the changes for correctness, security, maintainability, architecture quality, and long-term technical debt.';
    sections.push(`## User Request\n${request}`);

    // Output contract
    sections.push(this.loadSection('read-only-constraints', READ_ONLY_REVIEW_CONSTRAINTS));
    sections.push(this.loadSection('json-output-contract', JSON_ONLY_OUTPUT_CONTRACT));

    return sections.join('\n\n');
  }
}
