import * as fs from 'fs';
import * as path from 'path';
import type { TaskMode } from '../core/types';

export interface PromptResolutionOptions {
  workspaceRoot?: string;
  extensionRoot?: string;
  fallback?: string;
}

/** Only alphanumeric characters, hyphens, and underscores — no path traversal possible. */
const SAFE_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;

function validateSegment(label: string, segment: string): void {
  if (!SAFE_SEGMENT_RE.test(segment)) {
    throw new Error(
      `Invalid prompt ${label}: "${segment}". Only alphanumeric characters, hyphens, and underscores are allowed.`,
    );
  }
}

const MODE_FALLBACKS: Record<TaskMode, string> = {
  ask: 'Answer the user directly using the provided context. Do not scan the project broadly unless needed.',
  research: 'Research the topic and cite or summarize relevant findings. Prefer external/web knowledge when available.',
  'scan-project': 'Inspect the project read-only. Summarize architecture, risks, missing pieces, and recommended next steps.',
  plan: 'Produce an implementation plan only. Do not mutate files or run commands that change project state. Treat attached files and folders as the primary source of truth.',
  brainstorm: [
    'Run an autonomous multi-agent brainstorming session.',
    'Use the provided markdown agent definitions as specialist personas.',
    'Do not modify files.',
    'Do not run destructive commands.',
    'Have each role contribute distinct ideas.',
    'Then synthesize, critique, rank, and recommend the strongest directions.',
    'Return the final answer in English.',
  ].join(' '),
  edit: 'Implement the requested code changes while keeping the patch scoped and consistent with the existing codebase.',
  debug: 'Investigate the failure, identify likely root causes, and apply a focused fix when enough evidence is available.',
  test: 'Run, create, or improve tests that validate the requested behavior. Report any failures clearly.',
  review: 'Review like a code reviewer: lead with bugs, regressions, missing tests, and concrete file references.',
};

/**
 * Resolves a prompt markdown file using the three-tier lookup:
 * 1. `{workspaceRoot}/.nexus/prompts/{category}/{name}.md`
 * 2. `{extensionRoot}/media/prompts/{category}/{name}.md`
 * 3. `options.fallback` (or empty string)
 */
export function loadPromptMarkdown(
  category: string,
  name: string,
  options?: PromptResolutionOptions,
): string {
  validateSegment('category', category);
  validateSegment('name', name);

  const fileName = `${name}.md`;

  if (options?.workspaceRoot) {
    try {
      const wsPath = path.join(options.workspaceRoot, '.nexus', 'prompts', category, fileName);
      const content = fs.readFileSync(wsPath, 'utf8').trim();
      if (content) return content;
    } catch {
      // not found — try next tier
    }
  }

  if (options?.extensionRoot) {
    try {
      const extPath = path.join(options.extensionRoot, 'media', 'prompts', category, fileName);
      const content = fs.readFileSync(extPath, 'utf8').trim();
      if (content) return content;
    } catch {
      // not found — use fallback
    }
  }

  return options?.fallback ?? '';
}

export function loadModeInstruction(mode: TaskMode, options?: PromptResolutionOptions): string {
  const fallback = MODE_FALLBACKS[mode] ?? '';
  return loadPromptMarkdown('modes', mode, { ...options, fallback });
}

export function loadWorkflowPrompt(name: string, options?: PromptResolutionOptions): string {
  return loadPromptMarkdown('workflows', name, options);
}

export function loadGatePrompt(name: string, options?: PromptResolutionOptions): string {
  return loadPromptMarkdown('gates', name, options);
}

export function loadOutputFormat(name: string, options?: PromptResolutionOptions): string {
  return loadPromptMarkdown('output-formats', name, options);
}

export function loadRecommendationPrompt(name: string, options?: PromptResolutionOptions): string {
  return loadPromptMarkdown('recommendations', name, options);
}
