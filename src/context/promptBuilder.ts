import { TaskMode } from '../core/types';
import { WorkspaceInfo } from './workspaceScanner';
import { PackageInfo } from './packageDetector';

export interface PromptContext {
  workspace: WorkspaceInfo;
  packages: PackageInfo;
  rules: string;
  mode: TaskMode;
}

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

  if (ctx.rules) {
    lines.push('');
    lines.push('# Project Rules');
    lines.push(ctx.rules);
  }

  lines.push('');
  lines.push('# Task');
  lines.push(userPrompt);

  return lines.join('\n');
}
