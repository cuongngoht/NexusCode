import { TaskMode } from '../core/types';
import { WorkspaceInfo } from './workspaceScanner';
import { PackageInfo } from './packageDetector';
import type { DebugContext } from '../debug/DebugContext';
import { buildDebugPrompt } from '../debug/debugPrompt';
import {
  loadModeInstruction,
  loadWorkflowPrompt,
  loadGatePrompt,
  loadOutputFormat,
  loadRecommendationPrompt,
  type PromptResolutionOptions,
} from './promptLibrary';

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
  /** Path to the VS Code extension root — used to resolve bundled media/prompts. */
  extensionRoot?: string;
  /** Template ref names for future Product Owner wiring — dormant until a controller selects them. */
  workflow?: string;
  clarificationGate?: string;
  recommendations?: string;
  outputFormat?: string;
  /** MCP tool intent instructions injected when MCP is enabled. */
  mcpIntentPrompt?: string;
  /** Research workflow context injected when @research is active. */
  researchContext?: string;
}

export function buildEnhancedPrompt(userPrompt: string, ctx: PromptContext): string {
  const lines: string[] = [];

  const resolutionOpts: PromptResolutionOptions = {
    workspaceRoot: ctx.workspace.root,
    extensionRoot: ctx.extensionRoot,
  };

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

  const modeGuidance = loadModeInstruction(ctx.mode, resolutionOpts);
  lines.push('');
  lines.push('# Mode Guidance');
  lines.push(modeGuidance);

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

  if (ctx.researchContext) {
    lines.push('');
    lines.push('# Research Context');
    lines.push(ctx.researchContext);
  }

  lines.push('');

  if (ctx.mode === 'debug' && ctx.debugContext) {
    lines.push(buildDebugPrompt(userPrompt, ctx.debugContext));
  } else {
    lines.push('# Task');
    lines.push(userPrompt);
  }

  if (ctx.workflow) {
    const content = loadWorkflowPrompt(ctx.workflow, resolutionOpts);
    if (content) {
      lines.push('');
      lines.push('# Workflow Prompt');
      lines.push(content);
    }
  }

  if (ctx.clarificationGate) {
    const content = loadGatePrompt(ctx.clarificationGate, resolutionOpts);
    if (content) {
      lines.push('');
      lines.push('# Clarification Gate');
      lines.push(content);
    }
  }

  if (ctx.recommendations) {
    const content = loadRecommendationPrompt(ctx.recommendations, resolutionOpts);
    if (content) {
      lines.push('');
      lines.push('# Recommendations');
      lines.push(content);
    }
  }

  if (ctx.outputFormat) {
    const content = loadOutputFormat(ctx.outputFormat, resolutionOpts);
    if (content) {
      lines.push('');
      lines.push('# Output Format');
      lines.push(content);
    }
  }

  if (ctx.mcpIntentPrompt) {
    lines.push('');
    lines.push(ctx.mcpIntentPrompt);
  }

  return lines.join('\n');
}

export function buildAgentAugmentedPrompt(params: {
  agentMarkdownBundle: string;
  userPrompt: string;
  existingEnhancedPrompt?: string;
}): string {
  const { agentMarkdownBundle, userPrompt, existingEnhancedPrompt } = params;

  if (existingEnhancedPrompt) {
    return `${agentMarkdownBundle}\n\n---\n\n${existingEnhancedPrompt}`;
  }

  return [
    agentMarkdownBundle,
    '',
    '---',
    '',
    '# User Task',
    '',
    userPrompt,
  ].join('\n');
}
