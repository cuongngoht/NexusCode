import type { CodeReviewContext } from './CodeReviewContextBuilder';

export type CodeReviewPreset = 'fast' | 'balanced' | 'architecture' | 'safe' | 'full';

export interface CodeReviewPromptInput {
  context: CodeReviewContext;
  userPrompt?: string;
  preset?: CodeReviewPreset;
}

const ARCHITECTURE_DIMENSIONS = `
## Architecture / OOP / OOD / Design Pattern Review

Architecture review is mandatory.

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

const OUTPUT_CONTRACT = `
## Output Contract

Return JSON first using this exact schema, then optionally add a markdown summary:

\`\`\`json
{
  "summary": "string",
  "verdict": "approve | approve-with-comments | request-changes",
  "architectureSummary": "string",
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
      "title": "string",
      "description": "string",
      "filePath": "string",
      "lineStart": 0,
      "lineEnd": 0,
      "evidence": "string",
      "recommendation": "string",
      "suggestedPatch": "string",
      "confidence": 0.0,
      "blocking": false,
      "violatedPrinciple": "string",
      "whyItMatters": "string",
      "refactorRecommendation": "string",
      "suggestedPattern": "string",
      "migrationRisk": "low | medium | high",
      "priority": "p0 | p1 | p2 | p3"
    }
  ]
}
\`\`\`

Rules:
- Every finding MUST have: severity, category, title, description, recommendation, confidence, blocking.
- Architecture/OOP/OOD findings MUST include evidence and whyItMatters.
- suggestedPattern is optional — only include if a specific pattern clearly solves a structural problem.
- architectureScore values are 0–100.
- confidence is 0.0–1.0.
`.trim();

function buildRoleSection(preset: CodeReviewPreset): string {
  const focusMap: Record<CodeReviewPreset, string> = {
    fast:         'Focus on critical bugs, security issues, and obvious blockers.',
    balanced:     'Review correctness, security, tests, maintainability, and architecture.',
    architecture: 'Focus primarily on architecture quality, OOP/OOD, design patterns, and long-term technical debt.',
    safe:         'Review everything: correctness, security, tests, maintainability, architecture, and design patterns.',
    full:         'Comprehensive review: correctness, regressions, security, performance, tests, maintainability, architecture, OOP/OOD, design patterns, long-term technical debt.',
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

Architecture review is mandatory regardless of preset.`.trim();
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
        ? '\n\n**Note:** The git diff was truncated because it exceeded the size limit. Prioritize the visible hunks and changed file list.'
        : '';
      sections.push(`## Git Diff\n\`\`\`diff\n${diff}\n\`\`\`${truncatedNote}`);
    }

    // Architecture review dimensions
    sections.push(ARCHITECTURE_DIMENSIONS);

    // User custom prompt
    const request = userPrompt?.trim() ||
      'Review the changes for correctness, security, maintainability, architecture quality, and long-term technical debt.';
    sections.push(`## User Request\n${request}`);

    // Output contract
    sections.push(OUTPUT_CONTRACT);

    return sections.join('\n\n');
  }
}
