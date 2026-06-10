import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { ExtensionMessage } from '../webviewProtocol';
import type { IEventBus, NexusEvent } from '../../core/events/IEventBus';
import type { ProviderId, TaskMode } from '../../core/types';
import { AgentTask } from '../../core/agent';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import { RunAgentUseCase } from '../../application/usecases/RunAgentUseCase';
import { NexusOrchestrator } from '../../application/nexus/NexusOrchestrator';
import { NexusPlanStore } from '../../application/nexus/NexusPlanStore';
import { BuildProjectMapUseCase } from '../../application/usecases/BuildProjectMapUseCase';
import { createPreSteps } from '../../application/pipeline/createPreSteps';
import { buildEnhancedPrompt } from '../../context/promptBuilder';
import { buildAugmentedPrompt } from '../../context/promptAugmentationBuilder';
import { buildPromptAttachmentContext } from '../../context/promptAttachments';
import { listAgentPrompts, loadAgentPromptBundle } from '../../context/agentPromptLibrary';
import { parseAgentMentions } from '../../context/agentMentionParser';
import { listSkillPrompts, loadSkillPromptBundle } from '../../context/skillPromptLibrary';
import { parseSkillMentions } from '../../context/skillMentionParser';
import { scanWorkspace } from '../../context/workspaceScanner';
import { detectPackageInfo } from '../../context/packageDetector';
import { loadRules } from '../../context/rulesLoader';
import { loadPlanContent } from '../../context/planLoader';
import { getGitStatus } from '../../git/gitStatus';
import { buildGitReviewContext } from '../../git/gitReviewContext';
import { loadReviewAgentMarkdown } from '../../context/reviewAgentLoader';
import { buildReviewPrompt } from '../../context/reviewPromptBuilder';
import { requireWorkspaceRoot } from './workspaceUtils';
import type { PromptAttachment } from '../../core/types';
import type { ChatHistoryState } from '../../core/chat/ChatHistory';
import type { SubagentOrchestrator, SubagentRunConfig } from '../../application/subagents/SubagentOrchestrator';
import type { SubagentPlanConfig } from '../../application/subagents/SubagentPlanner';
import { SubagentSummary } from '../../application/subagents/SubagentSummary';

const RUN_STEP_LABEL = 'analyze';

const SCAN_PROJECT_DEFAULT =
  "Summarize this project's architecture, detected units, tech stack, and suggest next steps.";

const REVIEW_DEFAULT =
  'Review the current branch against the selected base branch. Focus on bugs, regressions, security, tests, and maintainability.';

export class RunTaskHandler {
  private _pipelineActive = false;

  constructor(
    private readonly runAgent: RunAgentUseCase,
    private readonly orchestrator: NexusOrchestrator,
    private readonly eventBus: IEventBus,
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly buildProjectMap: BuildProjectMapUseCase,
    private readonly extensionPath: string,
    private readonly subagentOrchestrator?: SubagentOrchestrator,
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
    attachments?: PromptAttachment[],
    subagentsEnabled = false,
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
      baseBranch: baseBranch || undefined,
    };

    const resolvedAttachments = attachments ?? [];
    if (resolvedAttachments.length > 0 || effectivePrompt.includes('@')) {
      const attachmentContext = buildPromptAttachmentContext(workspaceRoot, effectivePrompt, resolvedAttachments);
      if (attachmentContext) {
        ctx.promptAttachments = resolvedAttachments;
        ctx.attachmentContext = attachmentContext;
      }
    }

    this._pipelineActive = true;
    try {
      if (providerId === 'nexus') {
        if (enableEnhancement) {
          ctx.enhancedPrompt = this.buildFinalPrompt(ctx, mode, workspaceRoot, baseBranch);
        }
        await this.orchestrator.run(ctx, 'auto');
      } else {
        const preSteps = createPreSteps(mode, {
          buildProjectMap: this.buildProjectMap,
          extensionPath: this.extensionPath,
        });

        const subagentCfg = vscode.workspace.getConfiguration('nexus');
        const subagentsOn = subagentsEnabled
          && !!this.subagentOrchestrator
          && subagentCfg.get<boolean>('subagents.enabled', false);

        const planCfg: SubagentPlanConfig = {
          mode,
          maxRuns: subagentCfg.get<number>('subagents.maxRuns', 4),
          includeSecurity: subagentCfg.get<boolean>('subagents.includeSecurity', false),
          includeDocs: subagentCfg.get<boolean>('subagents.includeDocs', false),
        };

        const subagentCount = subagentsOn
          ? this.subagentOrchestrator!.countPlanned(planCfg)
          : 0;

        const totalSteps = preSteps.length + subagentCount + 1;

        const ok = await this.runPreSteps(preSteps, ctx, providerId, mode, model, totalSteps);
        if (!ok) return;

        if (subagentsOn && subagentCount > 0) {
          const runCfg: SubagentRunConfig = {
            ...planCfg,
            maxCharsPerResult: 6000,
          };
          const subResults = await this.subagentOrchestrator!.run(
            ctx,
            e => this.eventBus.emit(e),
            runCfg,
            preSteps.length,
            totalSteps,
          );
          ctx.subagentResults = subResults;
        }

        if (enableEnhancement) {
          ctx.enhancedPrompt = this.buildFinalPrompt(ctx, mode, workspaceRoot, baseBranch);
        }

        await this.executeAgent(ctx, providerId, mode, model, preSteps.length + subagentCount, totalSteps, workspaceRoot, cfg);
      }
    } finally {
      this._pipelineActive = false;
    }
  }

  async applyPlan(mode: TaskMode, model?: string, planPath?: string, providerId?: ProviderId): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;

    if (this.hasActive()) {
      this.post({ type: 'taskError', taskId: 'apply-plan', message: 'A task is already running. Stop it first.' });
      return;
    }

    const plan = NexusPlanStore.load(workspaceRoot, planPath);
    if (!plan) {
      this.post({ type: 'taskError', taskId: 'apply-plan', message: 'No saved plan found. Run a search+plan first.' });
      return;
    }

    const approvedPlanPrompt = [
      'Apply the following approved implementation plan.',
      '',
      'Rules:',
      '- Follow the plan as closely as possible.',
      '- Do not introduce unrelated changes.',
      '- Before editing, inspect the relevant files.',
      '- If the plan is impossible or unsafe, stop and explain why.',
      '- After editing, summarize changed files and verification steps.',
      '',
      '<approved_plan>',
      plan,
      '</approved_plan>',
    ].join('\n');

    const effectiveProvider: ProviderId = providerId ?? 'nexus';

    const ctx: PipelineContext = {
      workspaceRoot,
      originalPrompt: approvedPlanPrompt,
      enhancedPrompt: approvedPlanPrompt,
      mode,
      model,
      providerId: effectiveProvider,
      enableEnhancement: false,
    };

    this._pipelineActive = true;
    try {
      if (effectiveProvider === 'nexus') {
        await this.orchestrator.run(ctx, 'code');
      } else {
        // Non-nexus provider: run the agent directly with the 'code' step label
        this.eventBus.emit({
          kind: 'step_started',
          stepLabel: 'code',
          stepIndex: 0,
          totalSteps: 1,
          provider: String(effectiveProvider),
          mode: String(mode),
          model,
        });
        const task = new AgentTask(
          approvedPlanPrompt,
          approvedPlanPrompt,
          effectiveProvider,
          mode,
          model?.trim() || undefined,
          workspaceRoot,
        );
        const cfg = vscode.workspace.getConfiguration('nexus');
        if (cfg.get<boolean>('runGitStatusAfterTask', true)) {
          this.setupGitStatusListener(task, workspaceRoot);
        }
        try {
          await this.runAgent.execute(task);
          this.eventBus.emit({ kind: 'step_completed', stepLabel: 'code' });
        } catch {
          this.eventBus.emit({ kind: 'step_error', stepLabel: 'code', error: '' });
        }
      }
    } finally {
      this._pipelineActive = false;
    }
  }

  async stop(): Promise<void> {
    await this.runAgent.stop();
  }

  async openPlan(planPath?: string): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;

    const target = planPath ?? path.join(workspaceRoot, '.nexus', 'plan.md');
    if (!fs.existsSync(target)) {
      this.post({ type: 'taskError', taskId: 'open-plan', message: 'No saved plan found. Run a search+plan first.' });
      return;
    }

    await vscode.window.showTextDocument(vscode.Uri.file(target));
  }

  async openSavedPlans(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;

    const runsDir = path.join(workspaceRoot, '.nexus', 'runs');
    if (!fs.existsSync(runsDir)) {
      this.post({ type: 'taskError', taskId: 'open-saved-plans', message: 'No saved plans found yet.' });
      return;
    }

    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(runsDir));
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
        reviewFileContents: ctx.reviewFileContents,
        conversationContext: ctx.conversationContext,
      });
    }

    const planContent = loadPlanContent(workspaceRoot) || undefined;

    // Parse @agent mentions from the original user prompt
    const knownAgentIds = listAgentPrompts(workspaceRoot).map(a => a.id);
    const { agentIds, cleanedPrompt: agentCleaned } = parseAgentMentions(ctx.originalPrompt, knownAgentIds);

    // Parse #skill mentions from the (agent-cleaned) prompt
    const knownSkillIds = listSkillPrompts(workspaceRoot).map(s => s.id);
    const agentCleanedPrompt = agentIds.length > 0 ? agentCleaned : ctx.originalPrompt;
    const { skillIds, cleanedPrompt: skillCleaned } = parseSkillMentions(agentCleanedPrompt, knownSkillIds);
    const taskPrompt = skillIds.length > 0 ? skillCleaned : agentCleanedPrompt;

    let prompt = buildEnhancedPrompt(taskPrompt, {
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
      attachmentContext: ctx.attachmentContext,
      extensionRoot: this.extensionPath,
    });

    if (agentIds.length > 0 || skillIds.length > 0) {
      const agentBundle = agentIds.length > 0 ? loadAgentPromptBundle(workspaceRoot, agentIds) : undefined;
      const skillBundle = skillIds.length > 0 ? loadSkillPromptBundle(workspaceRoot, skillIds) : undefined;
      prompt = buildAugmentedPrompt({
        agentMarkdownBundle: agentBundle,
        skillMarkdownBundle: skillBundle,
        userPrompt: taskPrompt,
        existingEnhancedPrompt: prompt,
      });
    }

    if (ctx.subagentResults && ctx.subagentResults.length > 0) {
      const block = new SubagentSummary().buildInjectionBlock(ctx.subagentResults);
      if (block) prompt = `${prompt}\n\n${block}`;
    }

    return prompt;
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

    try {
      await this.runAgent.execute(task);
      this.eventBus.emit({ kind: 'step_completed', stepLabel: RUN_STEP_LABEL });
    } catch {
      this.eventBus.emit({ kind: 'step_error', stepLabel: RUN_STEP_LABEL, error: '' });
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
}
