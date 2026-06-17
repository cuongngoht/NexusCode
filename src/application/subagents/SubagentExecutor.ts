import * as fs from 'fs';
import * as path from 'path';
import { AgentTask } from '../../core/agent/AgentTask';
import type { IAgent } from '../../core/agent';
import type { IProcessRunner } from '../../core/runner/IProcessRunner';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { SubagentDefinition } from './SubagentDefinition';
import type { SubagentResult } from './SubagentResultStore';
import { SubagentSummary } from './SubagentSummary';

const PROJECT_MAP_PREVIEW_CHARS = 2000;

export class SubagentExecutor {
  private readonly summary = new SubagentSummary();

  constructor(
    private readonly runner: IProcessRunner,
    private readonly extensionPath: string,
  ) {}

  async execute(
    def: SubagentDefinition,
    agent: IAgent,
    ctx: PipelineContext,
    maxChars: number,
    idleTimeoutMs?: number,
  ): Promise<SubagentResult> {
    const start = Date.now();
    try {
      const template = this.loadTemplate(def.promptFile, ctx.mode, def.role);
      const prompt = this.buildPrompt(template, ctx, def.role);

      const task = new AgentTask(
        prompt,
        prompt,
        agent.id,
        'ask',
        undefined,
        ctx.workspaceRoot,
      );

      const command = agent.buildCommand(task);
      const chunks: string[] = [];
      await this.runner.run(command, {
        cwd: ctx.workspaceRoot,
        onStdout: chunk => { chunks.push(chunk); },
        onStderr: () => { /* discard subagent stderr */ },
        idleTimeoutMs,
      });

      const raw = chunks.join('');
      return {
        role: def.role,
        agentId: agent.id,
        compactOutput: this.summary.compact(raw.trim(), maxChars),
        rawOutput: def.role === 'reviewer' ? raw : undefined,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        role: def.role,
        agentId: agent.id,
        compactOutput: '',
        durationMs: Date.now() - start,
        error: String(err),
      };
    }
  }

  async runRawPrompt(agent: IAgent, prompt: string, cwd: string, idleTimeoutMs?: number): Promise<string> {
    const task = new AgentTask(prompt, prompt, agent.id, 'ask', undefined, cwd);
    const command = agent.buildCommand(task);
    const chunks: string[] = [];
    await this.runner.run(command, {
      cwd,
      onStdout: chunk => { chunks.push(chunk); },
      onStderr: () => {},
      idleTimeoutMs,
    });
    return chunks.join('');
  }

  async stop(): Promise<void> {
    await this.runner.stop();
  }

  private loadTemplate(promptFile: string, mode?: string, role?: string): string {
    const file = (mode === 'review' && role === 'reviewer')
      ? 'subagents/reviewer-code-review.md'
      : promptFile;
    const filePath = path.join(this.extensionPath, 'media', file);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return `You are a focused ${path.basename(promptFile, '.md')} assistant. Analyze the task and provide concise, relevant output.`;
    }
  }

  private buildPrompt(template: string, ctx: PipelineContext, role?: string): string {
    const parts = [template.trim()];

    if (ctx.projectMap) {
      const preview = ctx.projectMap.slice(0, PROJECT_MAP_PREVIEW_CHARS);
      parts.push(`\n# Project Overview\n${preview}`);
    }

    if (ctx.reviewFileContents && role === 'reviewer') {
      parts.push(`\n# Changed Files\n${ctx.reviewFileContents}`);
    }

    parts.push(`\n# Task\n${ctx.originalPrompt}`);
    return parts.join('\n');
  }
}
