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
  ): Promise<SubagentResult> {
    const start = Date.now();
    try {
      const template = this.loadTemplate(def.promptFile);
      const prompt = this.buildPrompt(template, ctx);

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
      });

      const raw = chunks.join('');
      return {
        role: def.role,
        agentId: agent.id,
        compactOutput: this.summary.compact(raw.trim(), maxChars),
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

  private loadTemplate(promptFile: string): string {
    const filePath = path.join(this.extensionPath, 'media', promptFile);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return `You are a focused ${path.basename(promptFile, '.md')} assistant. Analyze the task and provide concise, relevant output.`;
    }
  }

  private buildPrompt(template: string, ctx: PipelineContext): string {
    const parts = [template.trim()];

    if (ctx.projectMap) {
      const preview = ctx.projectMap.slice(0, PROJECT_MAP_PREVIEW_CHARS);
      parts.push(`\n# Project Overview\n${preview}`);
    }

    parts.push(`\n# Task\n${ctx.originalPrompt}`);
    return parts.join('\n');
  }
}
