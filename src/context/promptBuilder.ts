import { TaskMode } from '../core/types';
import { WorkspaceInfo } from './workspaceScanner';
import { PackageInfo } from './packageDetector';
import type { DebugContext } from '../debug/DebugContext';
import { buildDebugPrompt } from '../debug/debugPrompt';

export interface PromptContext {
  workspace: WorkspaceInfo;
  packages: PackageInfo;
  rules: string;
  mode: TaskMode;
  projectMap?: string;
  sourceContext?: string;
  conversationContext?: string;
  brainstormAgents?: string;
  debugContext?: DebugContext;
  planContent?: string;
  attachmentContext?: string;
}

const MODE_INSTRUCTIONS: Record<TaskMode, string> = {
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

export function buildEnhancedPrompt(userPrompt: string, ctx: PromptContext): string {
  const lines: string[] = [];

  lines.push(`# Workspace: ${ctx.workspace.name}`);
  lines.push(`Root: ${ctx.workspace.root}`);

  if (ctx.workspace.gitBranch) {
    lines.push(`Git branch: ${ctx.workspace.gitBranch}`);
  }

  if (ctx.packages.manager !== 'unknown') {
    lines.push(`Package manager: ${ctx.packages.manager}`);
  }

  if (ctx.packages.frameworks.length > 0) {
    lines.push(`Frameworks: ${ctx.packages.frameworks.join(', ')}`);
  }

  if (ctx.packages.scripts.length > 0) {
    lines.push(`Available scripts: ${ctx.packages.scripts.join(', ')}`);
  }

  lines.push(`Task mode: ${ctx.mode}`);
  lines.push(`Mode guidance: ${MODE_INSTRUCTIONS[ctx.mode]}`);

  if (ctx.rules) {
    lines.push('');
    lines.push('# Project Rules');
    lines.push(ctx.rules);
  }

  if (ctx.attachmentContext) {
    lines.push('');
    lines.push('# Attached Files');
    lines.push(ctx.attachmentContext);
  }

  if (ctx.sourceContext) {
    lines.push('');
    lines.push('# Key Source Files');
    lines.push(ctx.sourceContext);
  }

  if (ctx.brainstormAgents) {
    lines.push('');
    lines.push('# Brainstorm Agent Definitions');
    lines.push(ctx.brainstormAgents);
  }

  if (ctx.projectMap) {
    lines.push('');
    lines.push('# Project Map');
    lines.push(ctx.projectMap);
  }

  if (ctx.conversationContext) {
    lines.push('');
    lines.push('# Previous conversation context');
    lines.push(ctx.conversationContext);
  }

  if (ctx.planContent) {
    lines.push('');
    lines.push('# Active Plan');
    lines.push(ctx.planContent);
  }

  lines.push('');

  if (ctx.mode === 'debug' && ctx.debugContext) {
    lines.push(buildDebugPrompt(userPrompt, ctx.debugContext));
  } else {
    lines.push('# Task');
    lines.push(userPrompt);
  }

  return lines.join('\n');
}
