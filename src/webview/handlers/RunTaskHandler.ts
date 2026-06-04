import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import type { IEventBus, NexusEvent } from '../../core/events/IEventBus';
import type { ProviderId, TaskMode } from '../../core/types';
import { AgentTask } from '../../core/agent';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import { RunAgentUseCase } from '../../application/usecases/RunAgentUseCase';
import { BuildProjectMapUseCase } from '../../application/usecases/BuildProjectMapUseCase';
import { createPreSteps } from '../../application/pipeline/createPreSteps';
import { buildEnhancedPrompt } from '../../context/promptBuilder';
import { scanWorkspace } from '../../context/workspaceScanner';
import { detectPackageInfo } from '../../context/packageDetector';
import { loadRules } from '../../context/rulesLoader';
import { loadPlanContent } from '../../context/planLoader';
import { getGitStatus } from '../../git/gitStatus';
import { buildGitReviewContext } from '../../git/gitReviewContext';
import { loadReviewAgentMarkdown } from '../../context/reviewAgentLoader';
import { buildReviewPrompt } from '../../context/reviewPromptBuilder';
import { requireWorkspaceRoot } from './workspaceUtils';
import type { ChatHistoryState } from '../../core/chat/ChatHistory';

const RUN_STEP_LABEL = 'analyze';

const SCAN_PROJECT_DEFAULT =
  "Summarize this project's architecture, detected units, tech stack, and suggest next steps.";

const REVIEW_DEFAULT =
  'Review the current branch against the selected base branch. Focus on bugs, regressions, security, tests, and maintainability.';

export class RunTaskHandler {
  private _pipelineActive = false;

  constructor(
    private readonly runAgent: RunAgentUseCase,
    private readonly eventBus: IEventBus,
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly buildProjectMap: BuildProjectMapUseCase,
    private readonly extensionPath: string,
  ) {}

  hasActive(): boolean {
    return this.runAgent.hasActiveTask() || this._pipelineActive;
  }

  async run(
    prompt: string,
    providerId: ProviderId,
    mode: TaskMode,
    model: string | undefined,
    baseBranch: string | undefined,
    latestHistory: ChatHistoryState | null,
    buildConversationContext: () => string | undefined,
  ): Promise<void> {
    if (!prompt.trim() && mode !== 'scan-project' && mode !== 'review') {
      this.post({ type: 'taskError', taskId: 'pre-task', message: 'Prompt must not be empty.' });
      return;
    }

    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;

    if (this.hasActive()) {
      this.post({ type: 'taskError', taskId: 'pre-task', message: 'A task is already running. Stop it first.' });
      return;
    }

    const effectivePrompt =
      prompt.trim() || (mode === 'review' ? REVIEW_DEFAULT : SCAN_PROJECT_DEFAULT);

    const cfg = vscode.workspace.getConfiguration('nexus');
    const enableEnhancement = cfg.get<boolean>('enablePromptEnhancement', true);

    const ctx: PipelineContext = {
      workspaceRoot,
      originalPrompt: effectivePrompt,
      mode,
      model,
      providerId,
      enableEnhancement,
      enhancedPrompt: effectivePrompt,
      conversationContext: latestHistory ? buildConversationContext() : undefined,
    };

    const preSteps = createPreSteps(mode, {
      buildProjectMap: this.buildProjectMap,
      extensionPath: this.extensionPath,
    });
    const totalSteps = preSteps.length + 1;

    this._pipelineActive = true;
    try {
      const ok = await this.runPreSteps(preSteps, ctx, providerId, mode, model, totalSteps);
      if (!ok) return;

      if (enableEnhancement) {
        ctx.enhancedPrompt = this.buildFinalPrompt(ctx, mode, workspaceRoot, baseBranch);
      }

      await this.executeAgent(ctx, providerId, mode, model, preSteps.length, totalSteps, workspaceRoot, cfg);
    } finally {
      this._pipelineActive = false;
    }
  }

  async stop(): Promise<void> {
    await this.runAgent.stop();
  }

  // ─── Private pipeline helpers ──────────────────────────────────────────────

  private async runPreSteps(
    steps: ReturnType<typeof createPreSteps>,
    ctx: PipelineContext,
    providerId: ProviderId,
    mode: TaskMode,
    model: string | undefined,
    totalSteps: number,
  ): Promise<boolean> {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.eventBus.emit({
        kind: 'step_started',
        stepLabel: step.label,
        stepIndex: i,
        totalSteps,
        provider: String(providerId),
        mode: String(mode),
        model,
      });
      try {
        await step.execute(ctx, e => this.eventBus.emit(e));
      } catch (err) {
        this.eventBus.emit({ kind: 'step_error', stepLabel: step.label, error: String(err) });
        this.post({ type: 'taskError', taskId: 'pipeline', message: `${step.label} failed: ${String(err)}` });
        return false;
      }
      this.eventBus.emit({ kind: 'step_completed', stepLabel: step.label });
    }
    return true;
  }

  private buildFinalPrompt(ctx: PipelineContext, mode: TaskMode, workspaceRoot: string, baseBranch?: string): string {
    const workspace = scanWorkspace(workspaceRoot);
    const packages = detectPackageInfo(workspaceRoot);
    const rules = loadRules(workspaceRoot);

    if (mode === 'review') {
      const reviewContext = buildGitReviewContext(workspaceRoot, baseBranch);
      const reviewAgentMarkdown = loadReviewAgentMarkdown(workspaceRoot, this.extensionPath);
      const workspaceContext = [
        `Workspace: ${workspace.name}${workspace.gitBranch ? ` | Branch: ${workspace.gitBranch}` : ''}`,
        rules ? `\n# Project Rules\n${rules}` : '',
      ].filter(Boolean).join('\n');
      return buildReviewPrompt({
        userPrompt: ctx.originalPrompt,
        reviewAgentMarkdown,
        reviewContext,
        baseWorkspacePrompt: workspaceContext || undefined,
      });
    }

    const planContent = loadPlanContent(workspaceRoot) || undefined;
    return buildEnhancedPrompt(ctx.originalPrompt, {
      workspace,
      packages,
      rules,
      mode,
      projectMap: ctx.projectMap,
      sourceContext: ctx.sourceContext,
      conversationContext: ctx.conversationContext,
      brainstormAgents: ctx.brainstormAgents,
      debugContext: ctx.debugContext,
      planContent,
    });
  }

  private async executeAgent(
    ctx: PipelineContext,
    providerId: ProviderId,
    mode: TaskMode,
    model: string | undefined,
    preStepCount: number,
    totalSteps: number,
    workspaceRoot: string,
    cfg: vscode.WorkspaceConfiguration,
  ): Promise<void> {
    this.eventBus.emit({
      kind: 'step_started',
      stepLabel: RUN_STEP_LABEL,
      stepIndex: preStepCount,
      totalSteps,
      provider: String(providerId),
      mode: String(mode),
      model,
    });

    const task = new AgentTask(
      ctx.originalPrompt,
      ctx.enhancedPrompt,
      providerId,
      mode,
      model?.trim() || undefined,
      workspaceRoot,
    );

    if (cfg.get<boolean>('runGitStatusAfterTask', true)) {
      this.setupGitStatusListener(task, workspaceRoot);
    }

    if (mode === 'plan') {
      this.setupPlanSaveListener(task, workspaceRoot);
    }

    try {
      await this.runAgent.execute(task);
      this.eventBus.emit({ kind: 'step_completed', stepLabel: RUN_STEP_LABEL });
    } catch {
      this.eventBus.emit({ kind: 'step_error', stepLabel: RUN_STEP_LABEL, error: '' });
      // task_error already emitted by runAgent and forwarded via forwardEvent
    }
  }

  private setupGitStatusListener(task: AgentTask, workspaceRoot: string): void {
    const listener = (event: NexusEvent) => {
      if (
        (event.kind === 'task_completed' || event.kind === 'task_stopped') &&
        event.task.id === task.id
      ) {
        this.eventBus.off('task_completed', listener);
        this.eventBus.off('task_stopped', listener);
        const status = getGitStatus(workspaceRoot);
        this.post({ type: 'gitStatus', changes: status.changes, message: status.message });
      }
    };
    this.eventBus.on('task_completed', listener);
    this.eventBus.on('task_stopped', listener);
  }

  private setupPlanSaveListener(task: AgentTask, workspaceRoot: string): void {
    const listener = (event: NexusEvent) => {
      if (event.kind === 'task_completed' && event.task.id === task.id) {
        this.eventBus.off('task_completed', listener);
        if (event.result.exitCode === 0 && event.result.stdout.trim()) {
          const nexusDir = path.join(workspaceRoot, '.nexus');
          fs.mkdirSync(nexusDir, { recursive: true });
          fs.writeFileSync(path.join(nexusDir, 'plan.md'), event.result.stdout.trim(), 'utf8');
          this.post({ type: 'planSaved', taskId: task.id });
        }
      }
    };
    this.eventBus.on('task_completed', listener);
  }
}
