import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { ExtensionMessage } from '../webviewProtocol';
import type { IEventBus, NexusEvent } from '../../core/events/IEventBus';
import type { ProviderId, TaskMode } from '../../core/types';
import { AgentTask } from '../../core/agent';
import { AgentResult } from '../../core/agent/AgentResult';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import { RunAgentUseCase } from '../../application/usecases/RunAgentUseCase';
import { NexusOrchestrator } from '../../application/nexus/NexusOrchestrator';
import { NexusPlanStore } from '../../application/nexus/NexusPlanStore';
import { BuildProjectMapUseCase } from '../../application/usecases/BuildProjectMapUseCase';
import { BuildArchitectureMemoryUseCase } from '../../application/usecases/BuildArchitectureMemoryUseCase';
import { createPreSteps } from '../../application/pipeline/createPreSteps';
import { buildEnhancedPrompt } from '../../context/promptBuilder';
import { buildAugmentedPrompt } from '../../context/promptAugmentationBuilder';
import { buildPromptAttachmentContext } from '../../context/promptAttachments';
import { ensureWorkspaceAgents, listAgentPrompts, loadAgentPromptBundle, loadAgentMetadata } from '../../context/agentPromptLibrary';
import { parseAgentMentions } from '../../context/agentMentionParser';
import { listSkillPrompts, loadSkillPromptBundle } from '../../context/skillPromptLibrary';
import { ensureWorkspacePrompts } from '../../context/promptLibrary';
import { parseSkillMentions } from '../../context/skillMentionParser';
import { scanWorkspace } from '../../context/workspaceScanner';
import { detectPackageInfo } from '../../context/packageDetector';
import { loadRules } from '../../context/rulesLoader';
import { loadPlanContent } from '../../context/planLoader';
import { getGitStatus } from '../../git/gitStatus';
import { CodeReviewContextBuilder } from '../../application/code-review/CodeReviewContextBuilder';
import { CodeReviewPromptBuilder } from '../../application/code-review/CodeReviewPromptBuilder';
import { CodeReviewResultParser } from '../../application/code-review/CodeReviewResultParser';
import { materializeReviewOutput } from '../../application/code-review/materializeReviewOutput';
import { CodeReviewPolicy } from '../../application/code-review/CodeReviewPolicy';
import { CodeReviewArchitecturePolicy } from '../../application/code-review/CodeReviewArchitecturePolicy';
import { CodeReviewSynthesizer } from '../../application/code-review/synthesis/CodeReviewSynthesizer';
import { suggestPreset } from '../../application/code-review/CodeReviewPresetSuggester';
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
import type { PermissionService } from '../../application/permissions/PermissionService';
import { NexusDiscoveryOrchestrator } from '../../context/project-map/NexusDiscoveryOrchestrator';
import {
  FsProjectMemoryManifestRepository,
  PROJECT_MEMORY_SCHEMA_VERSION,
  ProjectMemoryStatusService,
  ProjectMemoryRagFacade,
  hashWorkspaceRoot,
  type ProjectMemoryManifest,
} from '../../context/project-memory';
import type { FileIntelligenceService } from '../../context/file-intelligence/FileIntelligenceService';
import type { IFileIntelligenceStore } from '../../context/file-intelligence/FileIntelligenceStore';
import type { FileIntelligenceIgnoreFilter } from '../../context/file-intelligence/FileIntelligenceIgnoreFilter';
import type { FileTouchEvent, FileTouchSource } from '../../context/file-intelligence/types';
import { SagaRunner } from '../../application/pipeline/SagaRunner';

export interface FileIntelligenceDeps {
  service: FileIntelligenceService;
  store: IFileIntelligenceStore;
  ignoreFilter: FileIntelligenceIgnoreFilter;
}

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
  private _stopRequested = false;

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
    private readonly permissionService?: PermissionService,
    private readonly projectMemoryStatusService: ProjectMemoryStatusService = new ProjectMemoryStatusService(),
    private readonly projectMemoryRagFacade?: ProjectMemoryRagFacade,
    private readonly fileIntelligenceDeps?: FileIntelligenceDeps,
  ) {}

  private readonly buildArchitectureMemory = new BuildArchitectureMemoryUseCase();
  private readonly sagaRunner = new SagaRunner();

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
    reviewTarget?: CodeReviewTarget,
    reviewPreset?: CodeReviewPreset,
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
    const resolvedReviewTarget = this.resolveReviewTarget(mode, baseBranch, cfg, reviewTarget);
    const projectMemoryStatus = await this.projectMemoryStatusService.getStatus(workspaceRoot);

    const ctx: PipelineContext = {
      workspaceRoot,
      originalPrompt: effectivePrompt,
      mode,
      model,
      providerId,
      enableEnhancement,
      enhancedPrompt: effectivePrompt,
      conversationContext: conversationContext ?? (latestHistory ? buildConversationContext(latestHistory, undefined, { maxChars: contextMaxChars, maxMessages: contextMaxMessages }) : undefined),
      baseBranch: resolvedReviewTarget?.baseBranch ?? baseBranch ?? undefined,
      reviewTarget: resolvedReviewTarget,
      projectMemoryStatus,
      isCancellationRequested: () => this._stopRequested,
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

    // Inject project memory RAG context if enabled and memory is ready
    const pmRagEnabled = cfg.get<boolean>('projectMemory.rag.enabled', true);
    if (pmRagEnabled && this.projectMemoryRagFacade && projectMemoryStatus) {
      try {
        // For review mode, augment the BM25 query with changed file paths so the
        // retrieval finds architecture sections relevant to the files being reviewed.
        let pmRagQuery = effectivePrompt;
        if (mode === 'review' && resolvedReviewTarget?.baseBranch) {
          try {
            const nameOnly = execFileSync(
              'git',
              ['diff', '--name-only', `${resolvedReviewTarget.baseBranch}...HEAD`],
              { cwd: workspaceRoot, encoding: 'utf8', timeout: 3_000, stdio: ['ignore', 'pipe', 'pipe'] },
            ).trim();
            if (nameOnly) {
              pmRagQuery = effectivePrompt + ' ' + nameOnly.replace(/\n/g, ' ');
            }
          } catch {
            // Non-blocking: git failure → use plain prompt
          }
        }

        const { ragContext, resultCount } = await this.projectMemoryRagFacade.buildRagForPrompt(
          pmRagQuery,
          workspaceRoot,
          projectMemoryStatus,
          {
            maxResults: cfg.get<number>('projectMemory.rag.maxResults', 5),
            maxChars: cfg.get<number>('projectMemory.rag.maxChars', 4000),
            minScore: cfg.get<number>('projectMemory.rag.minScore', 1.0),
          },
        );
        if (ragContext && resultCount > 0) {
          ctx.conversationContext = ragContext +
            (ctx.conversationContext ? '\n\n' + ctx.conversationContext : '');
        }
      } catch {
        // Non-blocking: project memory RAG failure must not prevent the task from running
      }
    }

    this._stopRequested = false;
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

      if (mode === 'scan-project') {
        const scanCfg = vscode.workspace.getConfiguration('nexus');
        this.eventBus.emit({
          kind: 'step_started',
          stepLabel: 'scan',
          stepIndex: 0,
          totalSteps: 1,
          provider: String(providerId),
          mode: 'scan-project',
          model,
        });
        try {
          const discoveryOrchestrator = new NexusDiscoveryOrchestrator(this.buildProjectMap);
          const result = await discoveryOrchestrator.run(
            workspaceRoot,
            (phase, activityKind, label) => {
              if (phase === 'started') {
                this.post({ type: 'activityStarted', activityKind, label });
              } else {
                this.post({ type: 'activityDone', activityKind, label, status: 'done' });
              }
            },
            {
              maxDepth: scanCfg.get<number>('projectMap.maxDepth', 6),
              maxFiles: scanCfg.get<number>('projectMap.maxFiles', 2000),
              addToGitignore: scanCfg.get<boolean>('projectMap.addToGitignore', false),
            },
          );
          this.eventBus.emit({ kind: 'step_completed', stepLabel: 'scan' });
          try {
            const tsFiles = result.mapOutput.tree.files.filter(
              (f: string) => f.endsWith('.ts') || f.endsWith('.tsx'),
            );
            await this.buildArchitectureMemory.execute({ workspaceRoot, files: tsFiles });
          } catch {
            // non-blocking — architecture memory is best-effort
          }
          this.post({
            type: 'projectScanCompleted',
            fileCount: result.mapOutput.tree.files.length,
            folderCount: result.mapOutput.tree.folders.length,
            unitCount: result.mapOutput.units.length,
            filesWritten: result.filesWritten,
          });
        } catch (err) {
          await this.markProjectMemoryFailed(workspaceRoot, err, 'discovery');
          this.eventBus.emit({ kind: 'step_error', stepLabel: 'scan', error: String(err) });
          this.post({ type: 'taskError', taskId: 'scan-project', message: `Project scan failed: ${String(err)}` });
        }
        return;
      }

      if (providerId === 'nexus') {
        if (enableEnhancement) {
          ctx.enhancedPrompt = this.buildFinalPrompt(ctx, mode, workspaceRoot);
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

          this.setupDebugIntelligenceListener(debugTask, workspaceRoot, effectivePrompt);

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
        const subagentCfg = cfg;
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

        const preSteps = createPreSteps(mode, {
          extensionPath: this.extensionPath,
          fileIntelligenceStore: this.fileIntelligenceDeps?.store,
          fileIntelligenceIgnoreFilter: this.fileIntelligenceDeps?.ignoreFilter,
        });

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

        const { supplementAgentIds, supplementCleanedPrompt } =
          this.detectReviewSupplement(mode, effectivePrompt, workspaceRoot);

        const postSteps = this.buildPostSteps(
          ctx, supplementAgentIds, supplementCleanedPrompt, providerId, mode, model, workspaceRoot, cfg,
        );

        const totalSteps = preSteps.length + subagentCount + postSteps.length;

        const ok = await this.runPreSteps(preSteps, ctx, providerId, mode, model, totalSteps);
        if (!ok) return;

        if (subagentsOn && subagentCount > 0) {
          const runCfg: SubagentRunConfig = {
            ...planCfg,
            maxCharsPerResult: 6000,
            maxParallel: mode === 'review' ? 1 : subagentCfg.get<number>('subagents.maxParallel', 2),
            failOpen: subagentCfg.get<boolean>('subagents.failOpen', true),
            timeoutMs: mode === 'review'
              ? subagentCfg.get<number>('review.subagentTimeoutMs', 120000)
              : subagentCfg.get<number>('subagents.timeoutMs', 30000),
            injectMaxChars: subagentCfg.get<number>('subagents.injectMaxChars', 8000),
          };
          const subResults = await this.subagentOrchestrator!.run(
            ctx,
            e => this.eventBus.emit(e),
            runCfg,
            preSteps.length,
            totalSteps,
          );
          ctx.subagentResults = [
            ...(ctx.subagentResults ?? []),
            ...subResults,
          ];
        }

        if (this._stopRequested) return;

        if (enableEnhancement) {
          ctx.enhancedPrompt = this.buildFinalPrompt(ctx, mode, workspaceRoot, reviewPreset);
        }

        if (this._stopRequested) return;

        await this.sagaRunner.run(postSteps, ctx, e => this.eventBus.emit(e), {
          isCancellationRequested: () => this._stopRequested,
          stepEventMeta: {
            stepOffset: preSteps.length + subagentCount,
            totalSteps,
            provider: String(providerId),
            mode: String(mode),
            model,
          },
        });
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
    this._stopRequested = true;
    await this.runAgent.stop();
    if (this.subagentOrchestrator) {
      await this.subagentOrchestrator.stop();
    }
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

  approvePermission(requestId: string): void {
    this.permissionService?.approve(requestId);
  }

  rejectPermission(requestId: string, reason?: string): void {
    this.permissionService?.reject(requestId, reason);
  }

  autoApprovePermission(requestId: string, scope: 'session' | 'workspace'): void {
    this.permissionService?.autoApprove(requestId, scope);
  }

  // ─── Private pipeline helpers ──────────────────────────────────────────────

  private resolveReviewTarget(
    mode: TaskMode,
    baseBranch: string | undefined,
    cfg: vscode.WorkspaceConfiguration,
    target?: CodeReviewTarget,
  ): CodeReviewTarget | undefined {
    if (mode !== 'review') return undefined;

    // Determine whether the default base branch is user-configured (not just package default)
    const inspected = cfg.inspect<string>('review.defaultBaseBranch');
    const hasUserConfiguredDefault =
      inspected?.globalValue !== undefined ||
      inspected?.workspaceValue !== undefined ||
      inspected?.workspaceFolderValue !== undefined;
    const autoUseDefault = cfg.get<boolean>('review.autoUseDefaultBaseBranch', false);
    const configuredDefault = hasUserConfiguredDefault ? cfg.get<string>('review.defaultBaseBranch') : undefined;
    const effectiveDefault = (autoUseDefault && configuredDefault) ? configuredDefault : (baseBranch ?? 'main');

    if (target) {
      if (target.type === 'branch') {
        return {
          ...target,
          baseBranch: target.baseBranch ?? baseBranch ?? effectiveDefault,
        };
      }
      return baseBranch && !target.baseBranch
        ? { ...target, baseBranch }
        : target;
    }

    return {
      type: 'branch',
      baseBranch: baseBranch ?? effectiveDefault,
    };
  }

  private async runPreSteps(
    steps: ReturnType<typeof createPreSteps>,
    ctx: PipelineContext,
    providerId: ProviderId,
    mode: TaskMode,
    model: string | undefined,
    totalSteps: number,
  ): Promise<boolean> {
    const result = await this.sagaRunner.run(
      steps,
      ctx,
      e => this.eventBus.emit(e),
      {
        isCancellationRequested: () => this._stopRequested,
        compensateOnFailure: false,
        stepEventMeta: {
          stepOffset: 0,
          totalSteps,
          provider: String(providerId),
          mode: String(mode),
          model,
        },
      },
    );

    if (!result.ok && !this._stopRequested) {
      this.post({ type: 'taskError', taskId: 'pipeline', message: `${result.failedStep} failed: ${result.error}` });
    }

    return result.ok;
  }

  private buildFinalPrompt(ctx: PipelineContext, mode: TaskMode, workspaceRoot: string, reviewPreset?: CodeReviewPreset): string {
    const workspace = scanWorkspace(workspaceRoot);
    const packages = detectPackageInfo(workspaceRoot);
    const rules = loadRules(workspaceRoot);

    if (mode === 'review') {
      const vsCfg = vscode.workspace.getConfiguration('nexus');
      const configPreset = (reviewPreset ?? vsCfg.get<string>('review.defaultPreset', 'architecture')) as CodeReviewPreset;
      const maxDiffChars = vsCfg.get<number>('review.maxDiffChars', 60000);
      const maxFileContextChars = vsCfg.get<number>('review.maxFileContextChars', 25000);

      const target: CodeReviewTarget = ctx.reviewTarget ?? { type: 'branch', baseBranch: ctx.baseBranch || 'main' };
      const reviewCtx = new CodeReviewContextBuilder().build(workspaceRoot, target, { maxDiffChars, maxFileContextChars });

      // Suggest optimal preset when user did not explicitly choose one
      const suggestion = reviewPreset ? { preset: reviewPreset, reason: '' } : suggestPreset(reviewCtx, configPreset);
      const preset = suggestion.preset;
      if (suggestion.reason) {
        this.post({ type: 'codeReviewProgress', reportId: 'pending', message: suggestion.reason });
      }

      ensureWorkspacePrompts(workspaceRoot, this.extensionPath, 'modes/review-code');
      const knownAgentIds = listAgentPrompts(workspaceRoot).map(a => a.id);
      const { cleanedPrompt: cleanedReviewPrompt } = parseAgentMentions(ctx.originalPrompt, knownAgentIds);
      let reviewPrompt = new CodeReviewPromptBuilder(this.extensionPath, workspaceRoot).build({
        context: reviewCtx,
        userPrompt: cleanedReviewPrompt || undefined,
        preset,
      });
      if (ctx.subagentResults && ctx.subagentResults.length > 0) {
        const injectMaxChars = vscode.workspace.getConfiguration('nexus').get<number>('subagents.injectMaxChars', 8000);
        const block = new SubagentSummary().buildInjectionBlock(ctx.subagentResults, { maxChars: injectMaxChars });
        if (block) reviewPrompt = `${reviewPrompt}\n\n${block}`;
      }
      return reviewPrompt;
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
      architectureContext: ctx.architectureContext,
      fileIntelligenceContext: ctx.fileIntelligenceContext,
    });

    if (agentIds.length > 0 || skillIds.length > 0) {
      const agentBundle = agentIds.length > 0 ? loadAgentPromptBundle(workspaceRoot, agentIds) : undefined;
      const skillBundle = skillIds.length > 0 ? loadSkillPromptBundle(workspaceRoot, skillIds) : undefined;
      const mcpEnabled = vscode.workspace.getConfiguration('nexus').get<boolean>('mcp.enabled', false);

      // When a review-capable agent is mentioned outside review mode, inject diff context
      // so the agent has actual code changes to work with.
      const hasReviewAgent = agentIds.some(id => {
        const meta = loadAgentMetadata(workspaceRoot, id);
        return meta?.purpose === 'code_review' || (meta?.reviewTargets && meta.reviewTargets.length > 0);
      });
      if (hasReviewAgent) {
        const vsCfg = vscode.workspace.getConfiguration('nexus');
        const maxDiffChars = vsCfg.get<number>('review.maxDiffChars', 60000);
        const maxFileContextChars = vsCfg.get<number>('review.maxFileContextChars', 25000);
        const target = ctx.reviewTarget ?? { type: 'branch' as const, baseBranch: ctx.baseBranch ?? 'main' };
        try {
          const reviewCtx = new CodeReviewContextBuilder().build(workspaceRoot, target, { maxDiffChars, maxFileContextChars });
          if (reviewCtx.changedFiles.length > 0 || reviewCtx.diff) {
            const fileList = reviewCtx.changedFiles.map(f => `  - ${f.status} ${f.path}`).join('\n');
            const diffContext = [
              '# Code Changes (Current Branch)',
              fileList ? `Changed files:\n${fileList}` : '',
              reviewCtx.diff ? `\`\`\`diff\n${reviewCtx.diff}\n\`\`\`` : '',
            ].filter(Boolean).join('\n\n');
            prompt = `${diffContext}\n\n${prompt}`;
          }
        } catch {
          // Non-blocking: if diff fails, proceed without it
        }
      }

      prompt = buildAugmentedPrompt({
        agentMarkdownBundle: agentBundle,
        skillMarkdownBundle: skillBundle,
        userPrompt: taskPrompt,
        existingEnhancedPrompt: prompt,
        mcpEnabled,
      });
    }

    if (ctx.subagentResults && ctx.subagentResults.length > 0) {
      const injectMaxChars = vscode.workspace.getConfiguration('nexus').get<number>('subagents.injectMaxChars', 8000);
      const block = new SubagentSummary().buildInjectionBlock(ctx.subagentResults, { maxChars: injectMaxChars });
      if (block) prompt = `${prompt}\n\n${block}`;
    }

    return prompt;
  }

  private detectReviewSupplement(
    mode: TaskMode,
    prompt: string,
    workspaceRoot: string,
  ): { supplementAgentIds: string[]; supplementCleanedPrompt: string } {
    if (mode !== 'review') return { supplementAgentIds: [], supplementCleanedPrompt: prompt };
    ensureWorkspaceAgents(workspaceRoot, this.extensionPath);
    const knownAgentIds = listAgentPrompts(workspaceRoot).map(a => a.id);
    const { agentIds, cleanedPrompt } = parseAgentMentions(prompt, knownAgentIds);
    return { supplementAgentIds: agentIds, supplementCleanedPrompt: cleanedPrompt };
  }

  private buildPostSteps(
    ctx: PipelineContext,
    supplementAgentIds: string[],
    supplementCleanedPrompt: string,
    providerId: ProviderId,
    mode: TaskMode,
    model: string | undefined,
    workspaceRoot: string,
    cfg: vscode.WorkspaceConfiguration,
  ): IPipelineStep[] {
    // When @agent is used in review mode, the agent's own guidelines drive the review.
    // Skip the generic CodeReviewPromptBuilder step entirely.
    if (mode === 'review' && supplementAgentIds.length > 0) {
      return [this.makeAgentSupplementStep(ctx, supplementAgentIds, supplementCleanedPrompt, providerId, model, workspaceRoot, cfg)];
    }
    const steps: IPipelineStep[] = [
      this.makeExecuteStep(ctx, providerId, mode, model, workspaceRoot, cfg),
    ];
    if (supplementAgentIds.length > 0) {
      steps.push(this.makeAgentSupplementStep(ctx, supplementAgentIds, supplementCleanedPrompt, providerId, model, workspaceRoot, cfg));
    }
    return steps;
  }

  private makeExecuteStep(
    ctx: PipelineContext,
    providerId: ProviderId,
    mode: TaskMode,
    model: string | undefined,
    workspaceRoot: string,
    cfg: vscode.WorkspaceConfiguration,
  ): IPipelineStep {
    return {
      label: mode === 'review' ? 'review-analyze' : RUN_STEP_LABEL,
      execute: async (_ctx, _emit) => {
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

        this.setupFileIntelligenceListener(task, workspaceRoot, mode, ctx.originalPrompt);
        this.setupActivityListener(task, workspaceRoot, mode);

        if (mode === 'review') {
          if (ctx.reviewEmptyDiff) {
            this.post({ type: 'taskError', taskId: task.id, message: 'Nothing to review: no changed files found between the current branch and the base branch. Commit your changes or select a different base branch.' });
            return;
          }

          const reviewTarget = ctx.reviewTarget ?? { type: 'branch', baseBranch: ctx.baseBranch || 'main' };

          if (ctx.subagentResults && ctx.subagentResults.length > 0) {
            this.eventBus.emit({ kind: 'activity_started', task, activityKind: 'tool_call', label: 'Synthesizing findings' });
            const report = new CodeReviewSynthesizer().synthesize(ctx.subagentResults, reviewTarget);
            if (report) {
              this.eventBus.emit({ kind: 'activity_done', task, activityKind: 'tool_call', label: 'Synthesizing findings', status: 'done' });
              this.emitFinalReport(report, cfg);
              return;
            }
            this.eventBus.emit({ kind: 'activity_done', task, activityKind: 'tool_call', label: 'Synthesizing findings', status: 'error' });
          }

          this.setupCodeReviewListener(task, cfg, reviewTarget);
        }

        await this.runAgent.execute(task);
      },
    };
  }

  private makeAgentSupplementStep(
    ctx: PipelineContext,
    agentIds: string[],
    cleanedPrompt: string,
    providerId: ProviderId,
    model: string | undefined,
    workspaceRoot: string,
    cfg: vscode.WorkspaceConfiguration,
  ): IPipelineStep {
    return {
      label: 'agent-review',
      execute: async (_ctx, _emit) => {
        const maxDiffChars = cfg.get<number>('review.maxDiffChars', 60000);
        const maxFileContextChars = cfg.get<number>('review.maxFileContextChars', 25000);
        const target = ctx.reviewTarget ?? { type: 'branch', baseBranch: ctx.baseBranch || 'main' };
        const reviewCtx = new CodeReviewContextBuilder().build(workspaceRoot, target, { maxDiffChars, maxFileContextChars });

        const fileList = reviewCtx.changedFiles
          .map(f => `  - ${f.status} ${f.path}`)
          .join('\n');
        const diffBlock = [
          '# Code Changes',
          `Base: \`${reviewCtx.baseBranch ?? 'main'}\` → current branch`,
          fileList ? `\nChanged files:\n${fileList}` : '',
          reviewCtx.diff ? `\n\`\`\`diff\n${reviewCtx.diff}\n\`\`\`` : '',
        ].filter(Boolean).join('\n');

        const taskInstruction = cleanedPrompt.trim()
          ? `# Task\n\n${cleanedPrompt.trim()}`
          : '# Task\n\nProvide your analysis of the code changes above according to your role and guidelines.';

        const agentBundle = loadAgentPromptBundle(workspaceRoot, agentIds);
        const mcpEnabled = cfg.get<boolean>('mcp.enabled', false);
        const supplementPrompt = buildAugmentedPrompt({
          agentMarkdownBundle: agentBundle,
          userPrompt: cleanedPrompt.trim() || 'Analyze the code changes',
          existingEnhancedPrompt: `${diffBlock}\n\n${taskInstruction}`,
          mcpEnabled,
        });

        const task = new AgentTask(
          cleanedPrompt.trim() || ctx.originalPrompt,
          supplementPrompt,
          providerId,
          'ask',
          model?.trim() || undefined,
          workspaceRoot,
        );

        await this.runAgent.execute(task);
      },
    };
  }

  private async markProjectMemoryFailed(workspaceRoot: string, error: unknown, phase: string): Promise<void> {
    const now = Date.now();
    const manifest: ProjectMemoryManifest = {
      version: 1,
      status: 'failed',
      workspaceRootHash: hashWorkspaceRoot(workspaceRoot),
      workspaceRootName: path.basename(workspaceRoot),
      schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
      source: 'manual_scan',
      createdAt: now,
      updatedAt: now,
      error: {
        message: error instanceof Error ? error.message : String(error),
        at: now,
        phase,
      },
    };
    try {
      await new FsProjectMemoryManifestRepository().writeManifest(workspaceRoot, manifest);
    } catch {
      // Preserve the original scan failure; manifest write errors are secondary here.
    }
  }

  private setupCodeReviewListener(
    task: AgentTask,
    cfg: vscode.WorkspaceConfiguration,
    target: CodeReviewTarget,
  ): void {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const reasoningChunks: string[] = [];

    const stdoutListener = (event: NexusEvent) => {
      if (event.kind === 'stdout' && event.task.id === task.id) {
        stdoutChunks.push(event.chunk);
      }
    };

    const stderrListener = (event: NexusEvent) => {
      if (event.kind === 'stderr' && event.task.id === task.id) {
        stderrChunks.push(event.chunk);
      }
    };

    const reasoningListener = (event: NexusEvent) => {
      if (event.kind === 'reasoning' && event.task.id === task.id) {
        reasoningChunks.push(event.chunk);
      }
    };

    const doneListener = (event: NexusEvent) => {
      if (
        (event.kind === 'task_completed' || event.kind === 'task_stopped') &&
        event.task.id === task.id
      ) {
        cleanup();
        if (event.kind === 'task_completed') {
          const rawOutput = materializeReviewOutput({
            stdoutText: stdoutChunks.join(''),
            stderrText: stderrChunks.join(''),
            reasoningText: reasoningChunks.join(''),
            processStdout: event.result.stdout,
            agentId: task.agentId,
          });
          this.emitCodeReviewReport(rawOutput, cfg, target);
        }
      }
      if (event.kind === 'task_error' && event.task.id === task.id) {
        cleanup();
      }
    };

    const cleanup = () => {
      this.eventBus.off('stdout', stdoutListener);
      this.eventBus.off('stderr', stderrListener);
      this.eventBus.off('reasoning', reasoningListener);
      this.eventBus.off('task_completed', doneListener);
      this.eventBus.off('task_stopped', doneListener);
      this.eventBus.off('task_error', doneListener);
    };

    this.eventBus.on('stdout', stdoutListener);
    this.eventBus.on('stderr', stderrListener);
    this.eventBus.on('reasoning', reasoningListener);
    this.eventBus.on('task_completed', doneListener);
    this.eventBus.on('task_stopped', doneListener);
    this.eventBus.on('task_error', doneListener);
  }

  private emitFinalReport(report: CodeReviewReport, cfg?: vscode.WorkspaceConfiguration): void {
    this.post({ type: 'codeReviewReport', report });

    // Save to review history (max 10)
    const history = this.workspaceState.get<CodeReviewReport[]>('nexus.review.history') ?? [];
    const updated = [report, ...history.filter(r => r.id !== report.id)].slice(0, 10);
    void this.workspaceState.update('nexus.review.history', updated);
    this.post({ type: 'reviewHistoryLoaded', reports: updated });

    const reviewCfg = cfg ?? vscode.workspace.getConfiguration('nexus');
    const openPanel = reviewCfg.get<boolean>('review.autoOpenReportPanel',
      reviewCfg.get<boolean>('review.openPanelOnCompletion', true));
    const columnStr = reviewCfg.get<string>('review.panelColumn', 'Two');

    if (openPanel) {
      void ReviewPanel.createOrShow(this.extensionUri, this.workspaceState, report, columnStr);
    }

    // Show a VS Code notification with the verdict and a quick-action button
    const blockerCount = (report.stats?.blocker ?? 0) + (report.stats?.critical ?? 0);
    const verdictLabel = report.verdict === 'approve' ? 'Approved'
      : report.verdict === 'approve-with-comments' ? 'Approved with comments'
      : 'Changes requested';
    const notifParts = [`Code review: ${verdictLabel}`];
    if (blockerCount > 0) notifParts.push(`(${blockerCount} blocker/critical)`);

    if (!openPanel) {
      void vscode.window.showInformationMessage(notifParts.join(' '), 'Open Report').then(choice => {
        if (choice === 'Open Report') {
          void ReviewPanel.createOrShow(this.extensionUri, this.workspaceState, report, columnStr);
        }
      });
    } else if (blockerCount > 0) {
      void vscode.window.showWarningMessage(notifParts.join(' '));
    }
  }

  private emitCodeReviewReport(
    rawOutput: string,
    cfg: vscode.WorkspaceConfiguration,
    target: CodeReviewTarget,
  ): void {
    try {
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

      this.emitFinalReport({ ...report, findings: sorted, verdict, architectureVerdict, architectureScore, stats }, cfg);
    } catch (err) {
      console.error('[RunTaskHandler] Code review report parsing failed:', err);
      this.post({
        type: 'codeReviewError',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private setupFileIntelligenceListener(
    task: AgentTask,
    workspaceRoot: string,
    mode: TaskMode,
    userIntent: string,
  ): void {
    if (!this.fileIntelligenceDeps) return;
    const { service } = this.fileIntelligenceDeps;

    const listener = (event: NexusEvent) => {
      if (
        (event.kind === 'task_completed' || event.kind === 'task_stopped' || event.kind === 'task_error') &&
        event.task.id === task.id
      ) {
        this.eventBus.off('task_completed', listener);
        this.eventBus.off('task_stopped', listener);
        this.eventBus.off('task_error', listener);

        if (event.kind !== 'task_error') {
          try {
            const changedFiles = this.getGitChangedFileNames(workspaceRoot);
            if (changedFiles.length > 0) {
              const touchEvents: FileTouchEvent[] = changedFiles.map(filePath => ({
                filePath,
                workspaceRoot,
                mode,
                reason: 'edit',
                source: 'edit',
                taskId: task.id,
                userIntent,
                confidence: 0.7,
                timestamp: Date.now(),
              }));
              service.processAsync(touchEvents);
            }
          } catch {
            // best-effort
          }
        }
      }
    };

    this.eventBus.on('task_completed', listener);
    this.eventBus.on('task_stopped', listener);
    this.eventBus.on('task_error', listener);
  }

  private getGitChangedFileNames(workspaceRoot: string): string[] {
    try {
      const result = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return result.split('\n').map(l => l.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  // Part 3 — capture debug investigation findings into file profiles
  private setupDebugIntelligenceListener(task: AgentTask, workspaceRoot: string, userIntent: string): void {
    if (!this.fileIntelligenceDeps) return;
    const { service } = this.fileIntelligenceDeps;

    let suspectedFiles: string[] = [];
    let rootCause: string | undefined;

    const listener = (event: NexusEvent) => {
      if (event.kind === 'debug_bm25_results') {
        suspectedFiles = event.results.map(r => r.path);
        return;
      }

      if (event.kind === 'debug_plan_ready' && event.plan && typeof event.plan === 'object') {
        const plan = event.plan as Record<string, unknown>;
        if (typeof plan['rootCause'] === 'string') rootCause = plan['rootCause'];
        const candidates = plan['candidateFiles'];
        if (Array.isArray(candidates)) {
          for (const f of candidates) {
            if (typeof f === 'string' && !suspectedFiles.includes(f)) suspectedFiles.push(f);
          }
        }
        return;
      }

      if (
        (event.kind === 'task_completed' || event.kind === 'task_stopped' || event.kind === 'task_error') &&
        event.task.id === task.id
      ) {
        this.eventBus.off('*', listener);
        if (event.kind === 'task_error') return;

        try {
          const now = Date.now();

          // Suspected files from BM25 + debug plan candidates
          if (suspectedFiles.length > 0) {
            const suspectedEvents: FileTouchEvent[] = suspectedFiles.map(filePath => ({
              filePath,
              workspaceRoot,
              mode: 'debug' as const,
              reason: 'debug' as const,
              source: 'debug' as const,
              taskId: task.id,
              userIntent,
              debugFindings: rootCause ? [{ role: 'suspected' as const, description: rootCause }] : undefined,
              confidence: 0.5,
              timestamp: now,
            }));
            service.processAsync(suspectedEvents);
          }

          // Confirmed files — actually changed by the fix
          const changedFiles = this.getGitChangedFileNames(workspaceRoot);
          if (changedFiles.length > 0) {
            const confirmedEvents: FileTouchEvent[] = changedFiles.map(filePath => ({
              filePath,
              workspaceRoot,
              mode: 'debug' as const,
              reason: 'debug' as const,
              source: 'debug' as const,
              taskId: task.id,
              userIntent,
              debugFindings: rootCause ? [{ role: 'confirmed' as const, description: rootCause }] : undefined,
              confidence: 0.9,
              timestamp: now,
            }));
            service.processAsync(confirmedEvents);
          }
        } catch {
          // best-effort
        }
      }
    };

    this.eventBus.on('*', listener);
  }

  // Part 2 — capture files the CLI read as context during any task
  private setupActivityListener(task: AgentTask, workspaceRoot: string, mode: TaskMode): void {
    if (!this.fileIntelligenceDeps) return;
    const { service, ignoreFilter } = this.fileIntelligenceDeps;

    const FILE_PATH_RE = /[\w./\-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|java|rs|rb|php|cs|cpp|c|h|swift)/g;
    const readFiles = new Set<string>();

    const listener = (event: NexusEvent) => {
      if (event.kind === 'activity_started' && event.task.id === task.id && event.activityKind === 'read') {
        const matches = event.label.match(FILE_PATH_RE) ?? [];
        for (const match of matches) {
          if (!ignoreFilter.shouldIgnore(match)) readFiles.add(match);
        }
        return;
      }

      if (
        (event.kind === 'task_completed' || event.kind === 'task_stopped' || event.kind === 'task_error') &&
        event.task.id === task.id
      ) {
        this.eventBus.off('*', listener);
        if (readFiles.size === 0) return;

        try {
          const contextReadEvents: FileTouchEvent[] = [...readFiles].map(filePath => ({
            filePath,
            workspaceRoot,
            mode,
            reason: 'context-read' as const,
            source: (mode === 'debug' ? 'debug' : mode === 'review' ? 'review' : 'edit') as FileTouchSource,
            taskId: task.id,
            contextReadMetadata: { purpose: mode, charCount: 0 },
            confidence: 0.2,
            timestamp: Date.now(),
          }));
          service.processAsync(contextReadEvents);
        } catch {
          // best-effort
        }
      }
    };

    this.eventBus.on('*', listener);
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
