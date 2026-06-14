import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { ExtensionMessage } from '../webviewProtocol';
import type { IEventBus, NexusEvent } from '../../core/events/IEventBus';
import type { ProviderId, TaskMode } from '../../core/types';
import { AgentTask } from '../../core/agent';
import { AgentResult } from '../../core/agent/AgentResult';
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
import { CodeReviewContextBuilder } from '../../application/code-review/CodeReviewContextBuilder';
import { CodeReviewPromptBuilder } from '../../application/code-review/CodeReviewPromptBuilder';
import { CodeReviewResultParser } from '../../application/code-review/CodeReviewResultParser';
import { CodeReviewPolicy } from '../../application/code-review/CodeReviewPolicy';
import { CodeReviewArchitecturePolicy } from '../../application/code-review/CodeReviewArchitecturePolicy';
import type { CodeReviewPreset } from '../../application/code-review/CodeReviewPromptBuilder';
import type { CodeReviewTarget } from '../../application/code-review/CodeReviewTarget';
import type { CodeReviewReport } from '../../application/code-review/CodeReviewReport';
import { requireWorkspaceRoot } from './workspaceUtils';
import { buildConversationContext } from '../../context/conversationContext';
import type { PromptAttachment } from '../../core/types';
import type { ChatHistoryState } from '../../core/chat/ChatHistory';
import type { SubagentOrchestrator, SubagentRunConfig } from '../../application/subagents/SubagentOrchestrator';
import type { SubagentPlanConfig } from '../../application/subagents/SubagentPlanner';
import { SubagentSummary } from '../../application/subagents/SubagentSummary';
import { classifySubagentIntent } from '../../application/subagents/SubagentIntentClassifier';
import type { SubagentMode, SubagentPreset, ReviewStepSettings } from '../../config/NexusConfig';
import { loadResearchContext } from '../../context/research/researchFolderLoader';
import { buildResearchContextBlock } from '../../context/research/researchPromptBuilder';
import type { HistoryRagFacade } from '../../context/history-search/HistoryRagFacade';
import type { HistoryRagSourceView } from '../../context/history-search/types';
import type { DebugOrchestrator } from '../../debug/orchestrator/DebugOrchestrator';
import type { AgentExecutor } from '../../application/agent-mode/AgentExecutor';
import { ReviewPanel } from '../../review/ReviewPanel';

const RUN_STEP_LABEL = 'analyze';

/**
 * RunTaskHandler
 *
 * Central coordinator for a user-initiated task from the webview.
 * Responsibilities:
 *  - Build rich PipelineContext (project map, conversation/RAG context, attachments, research, git, rules, debug signals, etc.)
 *  - Run pre-steps (via createPreSteps) + subagent orchestration when enabled
 *  - Delegate the "heavy lifting" to:
 *      • NexusOrchestrator (for multi-stage plan/code flows)
 *      • RunAgentUseCase (single-shot or final code execution + MCP)
 *      • DebugOrchestrator (special debug mode)
 *  - Stream events back and manage cancellation state.
 *
 * It has grown to touch many context builders — further extraction of mode-specific
 * "ContextAssembler" strategies would be a natural future cleanup.
 */

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
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceState: vscode.Memento,
    private readonly subagentOrchestrator?: SubagentOrchestrator,
    private readonly historyRagFacade?: HistoryRagFacade,
    private readonly debugOrchestrator?: DebugOrchestrator,
    private readonly agentExecutor?: AgentExecutor,
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
    conversationContext: string | undefined,
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
    const contextMaxChars = cfg.get<number>('context.maxChars', 100_000);
    const contextMaxMessages = cfg.get<number>('context.maxMessages', 20);

    const ctx: PipelineContext = {
      workspaceRoot,
      originalPrompt: effectivePrompt,
      mode,
      model,
      providerId,
      enableEnhancement,
      enhancedPrompt: effectivePrompt,
      conversationContext: conversationContext ?? (latestHistory ? buildConversationContext(latestHistory, undefined, { maxChars: contextMaxChars, maxMessages: contextMaxMessages }) : undefined),
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

    // Inject history RAG context if enabled
    const ragCfg = vscode.workspace.getConfiguration('nexus');
    const ragEnabled = ragCfg.get<boolean>('historyRag.enabled', true);
    if (ragEnabled && this.historyRagFacade && latestHistory) {
      try {
        const { ragContext, results } = await this.historyRagFacade.buildRagForPrompt(
          effectivePrompt,
          latestHistory,
          {
            maxResults: ragCfg.get<number>('historyRag.maxResults', 5),
            maxChars: ragCfg.get<number>('historyRag.maxChars', 6000),
            minScore: ragCfg.get<number>('historyRag.minScore', 1.25),
          },
        );
        if (ragContext) {
          ctx.conversationContext = ragContext +
            (ctx.conversationContext ? '\n\n' + ctx.conversationContext : '');
          const ragSources: HistoryRagSourceView[] = results.map(r => ({
            conversationId: r.document.conversationId,
            conversationTitle: r.document.title,
            role: r.document.role,
            score: r.score,
          }));
          this.post({
            type: 'historyRagContextUsed',
            resultCount: results.length,
            totalChars: ragContext.length,
            sources: ragSources,
          });
        }
      } catch {
        // Non-blocking: RAG failure must not prevent the task from running
      }
    }

    this._pipelineActive = true;
    try {
      // Agent Mode takes precedence over normal routing
      if (mode === 'agent') {
        if (this.agentExecutor) {
          await this.agentExecutor.run({
            prompt: effectivePrompt,
            workspaceRoot,
            providerId,
            model,
            baseBranch,
            conversationContext: ctx.conversationContext,
            attachments: resolvedAttachments,
            subagentsEnabled,
          });
        } else {
          this.post({ type: 'taskError', taskId: 'agent-mode', message: 'Agent Mode executor is not initialized.' });
        }
        return;
      }

      if (providerId === 'nexus') {
        if (enableEnhancement) {
          ctx.enhancedPrompt = this.buildFinalPrompt(ctx, mode, workspaceRoot, baseBranch);
        }
        // Route debug mode through the dedicated DebugOrchestrator
        if (mode === 'debug' && this.debugOrchestrator) {
          const debugCfg = vscode.workspace.getConfiguration('nexus');

          // Fabricate a task for lifecycle / analytics / streaming finalization.
          // The actual work (investigation + optional inner ApplyFix for autoApprove)
          // may produce additional inner tasks or reuse plan/apply paths.
          const debugTask = new AgentTask(
            effectivePrompt,
            ctx.enhancedPrompt,
            providerId,
            mode,
            model?.trim() || undefined,
            workspaceRoot,
          );
          this.eventBus.emit({
            kind: 'task_started',
            task: debugTask,
            enhancedPrompt: ctx.enhancedPrompt,
          });

          try {
            await this.debugOrchestrator.run({
              workspaceRoot,
              originalPrompt: effectivePrompt,
              enhancedPrompt: ctx.enhancedPrompt,
              providerId,
              mode,
              model,
              autoApprove: ctx.autoApprove ?? debugCfg.get<boolean>('debug.autoApprove', false),
              maxBm25Results: debugCfg.get<number>('debug.bm25.maxResults', 12),
              maxInvestigationRounds: debugCfg.get<number>('debug.react.maxRounds', 4),
              addRegressionTest: debugCfg.get<boolean>('debug.addRegressionTest', true),
              rerunAfterFix: debugCfg.get<boolean>('debug.rerunAfterFix', true),
              bm25Enabled: debugCfg.get<boolean>('debug.bm25.enabled', true),
              reactEnabled: debugCfg.get<boolean>('debug.react.enabled', true),
            });
            const okResult = new AgentResult(0, '', '', Date.now() - debugTask.startedAt);
            this.eventBus.emit({ kind: 'task_completed', task: debugTask, result: okResult });
          } catch (err) {
            const msg = String(err);
            const failResult = new AgentResult(1, '', msg, Date.now() - debugTask.startedAt);
            this.eventBus.emit({ kind: 'task_error', task: debugTask, error: msg });
            // also emit completed with failure for listeners that only key off completed
            this.eventBus.emit({ kind: 'task_completed', task: debugTask, result: failResult });
          }
          return;
        }
        await this.orchestrator.run(ctx, 'auto');
      } else {
        const preSteps = createPreSteps(mode, {
          extensionPath: this.extensionPath,
        });

        const subagentCfg = vscode.workspace.getConfiguration('nexus');
        const subagentMode = subagentCfg.get<SubagentMode>('subagents.mode', 'auto');
        const subagentsOn = subagentsEnabled
          && !!this.subagentOrchestrator
          && subagentCfg.get<boolean>('subagents.enabled', false)
          && subagentMode !== 'off';

        const baseMaxRuns = subagentCfg.get<number>('subagents.maxRuns', 4);
        const modeMaxRunsKey = `subagents.${mode}.maxRuns`;
        const modeMaxRuns = subagentCfg.get<number | undefined>(modeMaxRunsKey, undefined);
        const effectiveMaxRuns = modeMaxRuns ?? baseMaxRuns;

        const intent = classifySubagentIntent({
          prompt: effectivePrompt,
          mode,
        });

        const reviewStepsCfg = vscode.workspace.getConfiguration('nexus');
        const enabledSteps: ReviewStepSettings | undefined = mode === 'review' ? {
          reviewer:  reviewStepsCfg.get<boolean>('review.steps.reviewer', true),
          tester:    reviewStepsCfg.get<boolean>('review.steps.tester', true),
          security:  reviewStepsCfg.get<boolean>('review.steps.security', true),
          architect: reviewStepsCfg.get<boolean>('review.steps.architect', true),
        } : undefined;

        const planCfg: SubagentPlanConfig = {
          mode,
          subagentMode,
          preset: subagentCfg.get<SubagentPreset>('subagents.preset', 'balanced'),
          maxRuns: effectiveMaxRuns,
          maxParallel: subagentCfg.get<number>('subagents.maxParallel', 2),
          hardCap: subagentCfg.get<number>('subagents.hardCap', 6),
          includeSecurity: subagentCfg.get<boolean>('subagents.includeSecurity', false),
          includeDocs: subagentCfg.get<boolean>('subagents.includeDocs', false),
          includeReviewer: subagentCfg.get<boolean>('subagents.includeReviewer', true),
          includeTester: subagentCfg.get<boolean>('subagents.includeTester', true),
          selectedRoles: subagentCfg.get<string[]>('subagents.selectedRoles', []),
          intent,
          enabledSteps,
        };

        const subagentCount = subagentsOn
          ? this.subagentOrchestrator!.countPlanned(planCfg)
          : 0;

        const totalSteps = preSteps.length + subagentCount + 1;

        const ok = await this.runPreSteps(preSteps, ctx, providerId, mode, model, totalSteps);
        if (!ok) return;

        if (subagentsOn && subagentCount > 0) {
          const runCfg: SubagentRunConfig = {
            mode,
            maxRuns: effectiveMaxRuns,
            includeSecurity: subagentCfg.get<boolean>('subagents.includeSecurity', false),
            includeDocs: subagentCfg.get<boolean>('subagents.includeDocs', false),
            maxCharsPerResult: 6000,
            maxParallel: subagentCfg.get<number>('subagents.maxParallel', 2),
            failOpen: subagentCfg.get<boolean>('subagents.failOpen', true),
            timeoutMs: subagentCfg.get<number>('subagents.timeoutMs', 30000),
            injectMaxChars: subagentCfg.get<number>('subagents.injectMaxChars', 8000),
            intent,
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

  async applyPlan(_mode: TaskMode, model?: string, planPath?: string, providerId?: ProviderId): Promise<void> {
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

    const approvedPlanPrompt = NexusPlanStore.buildApprovedPlanPrompt(plan);

    const effectiveProvider: ProviderId = providerId ?? 'nexus';

    const ctx: PipelineContext = {
      workspaceRoot,
      originalPrompt: approvedPlanPrompt,
      enhancedPrompt: approvedPlanPrompt,
      mode: 'edit',
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
          mode: 'edit',
          model,
        });
        const task = new AgentTask(
          approvedPlanPrompt,
          approvedPlanPrompt,
          effectiveProvider,
          'edit',
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
    if (!this.hasActive()) return; // no-op — no task is running
    await this.runAgent.stop();
    // Also cancel any in-flight debug orchestrator (ReAct investigation, searches, verification commands).
    // The debug path uses its own chain and does not go through runAgent for the investigation phase.
    if (this.debugOrchestrator) {
      await this.debugOrchestrator.stop();
    }
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

  async rejectPlan(planPath?: string): Promise<void> {
    this.post({ type: 'planRejected', planPath });
  }

  async approveAgentPlan(sessionId: string): Promise<void> {
    if (this.agentExecutor) {
      await this.agentExecutor.continueAfterApproval(sessionId);
    }
  }

  async rejectAgentPlan_agent(sessionId: string, reason?: string): Promise<void> {
    if (this.agentExecutor) {
      await this.agentExecutor.rejectPlan(sessionId, reason);
    }
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
      const vsCfg = vscode.workspace.getConfiguration('nexus');
      const preset = (vsCfg.get<string>('review.defaultPreset', 'architecture')) as CodeReviewPreset;
      const maxDiffChars = vsCfg.get<number>('review.maxDiffChars', 60000);
      const maxFileContextChars = vsCfg.get<number>('review.maxFileContextChars', 25000);

      const target: CodeReviewTarget = { type: 'branch', baseBranch: baseBranch || 'main' };
      const reviewCtx = new CodeReviewContextBuilder().build(workspaceRoot, target, { maxDiffChars, maxFileContextChars });
      return new CodeReviewPromptBuilder().build({
        context: reviewCtx,
        userPrompt: ctx.originalPrompt || undefined,
        preset,
      });
    }

    const planContent = loadPlanContent(workspaceRoot) || undefined;

    // Detect @research mention before normal agent/skill parsing
    const researchResult = loadResearchContext(workspaceRoot, ctx.originalPrompt);
    const researchContext = researchResult ? buildResearchContextBlock(researchResult) : undefined;
    const promptForParsing = researchResult ? researchResult.cleanedPrompt : ctx.originalPrompt;

    // Parse @agent mentions from the (research-cleaned) prompt
    const knownAgentIds = listAgentPrompts(workspaceRoot).map(a => a.id);
    const { agentIds: parsedAgentIds, cleanedPrompt: agentCleaned } = parseAgentMentions(promptForParsing, knownAgentIds);

    // If @research is active, also inject the assigned research agent
    const agentIds = researchResult
      ? [...new Set([researchResult.assignedAgent, ...parsedAgentIds])]
      : parsedAgentIds;

    // Parse #skill mentions from the (agent-cleaned) prompt
    const knownSkillIds = listSkillPrompts(workspaceRoot).map(s => s.id);
    const agentCleanedPrompt = parsedAgentIds.length > 0 ? agentCleaned : promptForParsing;
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
      researchContext,
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
      const injectMaxChars = vscode.workspace.getConfiguration('nexus').get<number>('subagents.injectMaxChars', 8000);
      const block = new SubagentSummary().buildInjectionBlock(ctx.subagentResults, { maxChars: injectMaxChars });
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

    if (mode === 'review') {
      this.setupCodeReviewListener(task, workspaceRoot, cfg);
    }

    try {
      await this.runAgent.execute(task);
      this.eventBus.emit({ kind: 'step_completed', stepLabel: RUN_STEP_LABEL });
    } catch {
      this.eventBus.emit({ kind: 'step_error', stepLabel: RUN_STEP_LABEL, error: '' });
    }
  }

  private setupCodeReviewListener(
    task: AgentTask,
    workspaceRoot: string,
    cfg: vscode.WorkspaceConfiguration,
  ): void {
    const chunks: string[] = [];

    const stdoutListener = (event: NexusEvent) => {
      if (event.kind === 'stdout' && event.task.id === task.id) {
        chunks.push(event.chunk);
      }
    };

    const doneListener = (event: NexusEvent) => {
      if (
        (event.kind === 'task_completed' || event.kind === 'task_stopped') &&
        event.task.id === task.id
      ) {
        cleanup();
        if (event.kind === 'task_completed') {
          this.emitCodeReviewReport(chunks.join(''), workspaceRoot, task, cfg);
        }
      }
      if (event.kind === 'task_error' && event.task.id === task.id) {
        cleanup();
      }
    };

    const cleanup = () => {
      this.eventBus.off('stdout', stdoutListener);
      this.eventBus.off('task_completed', doneListener);
      this.eventBus.off('task_stopped', doneListener);
      this.eventBus.off('task_error', doneListener);
    };

    this.eventBus.on('stdout', stdoutListener);
    this.eventBus.on('task_completed', doneListener);
    this.eventBus.on('task_stopped', doneListener);
    this.eventBus.on('task_error', doneListener);
  }

  private emitCodeReviewReport(
    rawOutput: string,
    workspaceRoot: string,
    task: AgentTask,
    cfg: vscode.WorkspaceConfiguration,
  ): void {
    try {
      const baseBranch = cfg.get<string>('review.defaultBaseBranch', 'main');
      const target: CodeReviewTarget = { type: 'branch', baseBranch };
      const blockBelow = cfg.get<number>('review.architectureScore.blockBelow', 50);
      const warnBelow = cfg.get<number>('review.architectureScore.warnBelow', 70);

      const resultParser = new CodeReviewResultParser();
      const policy = new CodeReviewPolicy();
      const archPolicy = new CodeReviewArchitecturePolicy();

      const report = resultParser.parse(rawOutput, target);
      const normalized = report.findings.map(f => policy.normalizeFinding(f));
      const deduped = policy.dedupeFindings(normalized);
      const sorted = policy.sortFindings(deduped);
      const verdict = policy.calculateVerdict(sorted);
      const architectureVerdict = archPolicy.calculateArchitectureVerdict(
        sorted,
        report.architectureScore,
        blockBelow,
        warnBelow,
      );
      const architectureScore = report.architectureScore
        ? archPolicy.clampArchitectureScore(report.architectureScore)
        : undefined;
      const stats = policy.calculateStats(sorted);

      const finalReport = {
        ...report,
        findings: sorted,
        verdict,
        architectureVerdict,
        architectureScore,
        stats,
      };

      // Update history state in webview (for history panel)
      this.post({
        type: 'codeReviewReport',
        report: finalReport,
      });

      // Save to review history (max 10)
      const history = this.workspaceState.get<CodeReviewReport[]>('nexus.review.history') ?? [];
      const updated = [finalReport, ...history.filter(r => r.id !== finalReport.id)].slice(0, 10);
      void this.workspaceState.update('nexus.review.history', updated);
      this.post({ type: 'reviewHistoryLoaded', reports: updated });

      // Always open the dedicated side panel
      void ReviewPanel.createOrShow(
        this.extensionUri,
        this.workspaceState,
        finalReport,
      );
    } catch (err) {
      // Non-fatal — review report parsing failed, streaming output already shown
      console.error('[RunTaskHandler] Code review report parsing failed:', err);
      // On error, fallback to chat display with error message
      this.post({
        type: 'codeReviewError',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private setupGitStatusListener(task: AgentTask, workspaceRoot: string): void {
    const listener = (event: NexusEvent) => {
      if (
        (event.kind === 'task_completed' || event.kind === 'task_stopped' || event.kind === 'task_error') &&
        event.task.id === task.id
      ) {
        this.eventBus.off('task_completed', listener);
        this.eventBus.off('task_stopped', listener);
        this.eventBus.off('task_error', listener);
        if (event.kind !== 'task_error') {
          const status = getGitStatus(workspaceRoot);
          this.post({ type: 'gitStatus', changes: status.changes, message: status.message });
        }
      }
    };
    this.eventBus.on('task_completed', listener);
    this.eventBus.on('task_stopped', listener);
    this.eventBus.on('task_error', listener);
  }
}
