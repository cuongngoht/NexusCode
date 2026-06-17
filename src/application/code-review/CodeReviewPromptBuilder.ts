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

const READ_ONLY_REVIEW_CONSTRAINTS = `
## Critical — read-only review

- Do **not** create, edit, or delete files. Do **not** use write/edit/apply_patch/shell tools to save the report.
- Output the **entire** review (Part 1 markdown + Part 2 \`\`\`json block) **only in your reply text**.
- Nexus parses your reply automatically; writing a report file (e.g. under \`.nexus/reviews/\`) will hang or fail the review flow.
`.trim();

const OUTPUT_CONTRACT = `
## Output Format

Your response has TWO parts in this exact order.

---

### Part 1 — Narrative Review (markdown, write this first)

Write a thorough, human-readable review with these numbered sections:

1. **Correctness & Tests** — State only what is supported by provided code, diff, context, or explicit test output. If no test output is provided, say exactly: "No test execution evidence was provided."
2. **Architecture & OOP Design** — Layer adherence (domain/application/infrastructure), cohesion, coupling, SOLID violations, ownership clarity. Reference concrete files and class names when available.
3. **Design Patterns** — Identify patterns already in use (Strategy, Factory, Chain of Responsibility, etc.). Call out missing or misapplied patterns only when there is a real structural problem. Be specific about why.
4. **Security** — Injection risks, credential exposure, input validation gaps, privilege escalation paths.
5. **Performance & Concurrency** — Hot-path allocations, blocking I/O, race conditions, throttling.
6. **Maintainability & Technical Debt** — Long methods, duplicated logic, unclear naming, test coverage gaps.

Rules for Part 1:
- Reference file names and line numbers where relevant and available.
- Do not invent line numbers; use file/class/function names instead when line numbers are unavailable.
- Each section is 2–5 sentences. Skip a section only if truly nothing relevant can be said from the provided evidence.
- This part streams live in the chat panel — make it readable as a PR review comment.

---

### Part 2 — Structured JSON Report (write this after Part 1)

After the narrative, output the structured findings inside a \`\`\`json block:

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
      "description": "1–3 sentences describing the problem",
      "filePath": "relative/path/to/file.ts",
      "lineStart": 0,
      "evidence": "<=150 chars of the relevant code snippet, or 'line unavailable: ...' when exact lines are unavailable",
      "recommendation": "1–2 sentences on how to fix",
      "confidence": 0.0,
      "blocking": false,
      "violatedPrinciple": "e.g. SRP, DIP (optional)",
      "whyItMatters": "1 sentence on impact — required for architecture/oop/ood/design-pattern findings",
      "refactorRecommendation": "concrete refactor suggestion (optional, architecture findings only)",
      "suggestedPattern": "pattern name only if it directly solves the problem (optional)",
      "migrationRisk": "low | medium | high (optional)",
      "priority": "p0 | p1 | p2 | p3 (optional)"
    }
  ]
}
\`\`\`

Rules for Part 2:
- Output valid JSON only inside the final \`\`\`json block.
- The JSON block must be the final content in the response.
- Every finding MUST have: severity, category, title, description, filePath, lineStart, evidence, recommendation, confidence, blocking.
- Code-related findings MUST include concrete evidence.
- Architecture/OOP/OOD/design-pattern findings MUST include evidence and whyItMatters.
- Do NOT include suggestedPatch — keep recommendations textual.
- architectureScore values must be integers from 0 to 100; confidence must be a number from 0.0 to 1.0.
- Aim for 5–15 findings only when the evidence supports them. Fewer findings are acceptable when there are fewer real issues.
- Skip trivial nit/style unless systemic or harmful.
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
    sections.push(ARCHITECTURE_DIMENSIONS);

    // Evidence and anti-hallucination rules
    sections.push(EVIDENCE_AND_ACCURACY_RULES);

    // User custom prompt
    const request = userPrompt?.trim() ||
      'Review the changes for correctness, security, maintainability, architecture quality, and long-term technical debt.';
    sections.push(`## User Request\n${request}`);

    // Output contract
    sections.push(READ_ONLY_REVIEW_CONSTRAINTS);
    sections.push(OUTPUT_CONTRACT);

    return sections.join('\n\n');
  }
}
