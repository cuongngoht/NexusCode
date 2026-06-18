import * as fs from 'fs';
import * as path from 'path';
import type { CodeReviewContext } from './CodeReviewContextBuilder';

export type CodeReviewPreset = 'fast' | 'balanced' | 'architecture' | 'safe' | 'full';

export interface CodeReviewPromptInput {
  context: CodeReviewContext;
  userPrompt?: string;
  preset?: CodeReviewPreset;
}


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
  constructor(
    private readonly extensionRoot?: string,
    private readonly workspaceRoot?: string,
  ) {}

  private loadSection(name: string, fallback: string): string {
    // Workspace override: users can edit .nexus/prompts/modes/review-code/{name}.md
    if (this.workspaceRoot) {
      try {
        const wsPath = path.join(this.workspaceRoot, '.nexus', 'prompts', 'modes', 'review-code', `${name}.md`);
        const content = fs.readFileSync(wsPath, 'utf8').trim();
        if (content) return content;
      } catch { /* not customised — try bundled */ }
    }
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
    sections.push(this.loadSection('architecture-dimensions', ''));

    // Performance review dimensions
    sections.push(this.loadSection('performance-dimensions', ''));

    // Evidence and anti-hallucination rules
    sections.push(this.loadSection('evidence-accuracy-rules', ''));

    // User custom prompt
    const request = userPrompt?.trim() ||
      'Review the changes for correctness, security, maintainability, architecture quality, and long-term technical debt.';
    sections.push(`## User Request\n${request}`);

    // Output contract
    sections.push(this.loadSection('read-only-constraints', ''));
    sections.push(this.loadSection('json-output-contract', ''));

    return sections.join('\n\n');
  }
}
