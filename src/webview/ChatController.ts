import * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage } from './webviewProtocol';
import type { IEventBus } from '../core/events/IEventBus';
import { RunAgentUseCase } from '../application/usecases/RunAgentUseCase';
import { NexusOrchestrator } from '../application/nexus/NexusOrchestrator';
import { BuildProjectMapUseCase } from '../application/usecases/BuildProjectMapUseCase';
import { ProviderDetector } from '../provider-hub/ProviderDetector';
import { ConfigService } from '../config/ConfigService';
import type { IChatHistoryStore } from './IChatHistoryStore';
import { RunTaskHandler } from './handlers/RunTaskHandler';
import type { SubagentOrchestrator } from '../application/subagents/SubagentOrchestrator';
import { HistoryHandler } from './handlers/HistoryHandler';
import { ProviderHandler } from './handlers/ProviderHandler';
import { ReviewHandler } from './handlers/ReviewHandler';
import { ChatReviewOrchestrator } from './handlers/ChatReviewOrchestrator';
import { AttachmentHandler } from './handlers/AttachmentHandler';
import { LoginHandler } from './handlers/LoginHandler';
import { NavigationHandler } from './handlers/NavigationHandler';
import { EventForwarder } from './handlers/EventForwarder';
import { AgentPromptHandler } from './handlers/AgentPromptHandler';
import { SkillPromptHandler } from './handlers/SkillPromptHandler';
import { CommandPromptHandler } from './handlers/CommandPromptHandler';
import { ResearchCommandHandler } from './handlers/ResearchCommandHandler';
import { CompactCommandHandler } from './handlers/CompactCommandHandler';
import { DiffHandler } from './handlers/DiffHandler';
import { ArtifactHandler } from './handlers/ArtifactHandler';
import { CodeBlockHandler } from './handlers/CodeBlockHandler';
import { AnalyticsHandler } from './handlers/AnalyticsHandler';
import { HistorySearchHandler } from './handlers/HistorySearchHandler';
import { ProjectMemoryHandler } from './handlers/ProjectMemoryHandler';
import type { ConversationCompactor } from '../context/ConversationCompactor';
import type { AnalyticsService } from '../analytics/AnalyticsService';
import { HistoryRagFacade } from '../context/history-search/HistoryRagFacade';
import { HistorySearchService } from '../context/history-search/HistorySearchService';
import { HistoryIndexBuilder } from '../context/history-search/index/HistoryIndexBuilder';
import { MementoHistoryIndexRepository } from '../context/history-search/index/MementoHistoryIndexRepository';
import { Bm25HistorySearchStrategy } from '../context/history-search/bm25/Bm25HistorySearchStrategy';
import { InMemoryBm25Engine } from '../context/history-search/bm25/InMemoryBm25Engine';
import { RagContextBuilder } from '../context/history-search/rag/RagContextBuilder';
import { createDefaultDebugOrchestrator } from '../debug/orchestrator/DebugOrchestratorFactory';
import { AgentExecutor } from '../application/agent-mode/AgentExecutor';
import { ReviewPanel } from '../review/ReviewPanel';
import { PermissionService } from '../application/permissions/PermissionService';
import type { ProviderId } from '../core/types';
import {
  ProjectMemoryStatusService,
  ProjectMemoryRagFacade,
  FsProjectMemoryIndexRepository,
} from '../context/project-memory';
import type { FileIntelligenceDeps } from './handlers/RunTaskHandler';

const PROVIDER_IDS = new Set<ProviderId>([
  'nexus', 'codex', 'claude', 'antigravity', 'copilot', 'aider', 'custom', 'grok', 'auto',
]);

function normalizeProviderId(value: string | undefined): ProviderId {
  if (value === 'gemini') return 'antigravity';
  return PROVIDER_IDS.has(value as ProviderId) ? value as ProviderId : 'auto';
}

export class ChatController {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly _workspaceState: vscode.Memento;
  private readonly _extensionUri: vscode.Uri;
  private readonly _post: (msg: ExtensionMessage) => void;
  private readonly runTaskHandler: RunTaskHandler;
  private readonly historyHandler: HistoryHandler;
  private readonly providerHandler: ProviderHandler;
  private readonly reviewHandler: ReviewHandler;
  private readonly chatReviewOrchestrator: ChatReviewOrchestrator;
  private readonly attachmentHandler: AttachmentHandler;
  private readonly loginHandler: LoginHandler;
  private readonly navigationHandler: NavigationHandler;
  private readonly agentPromptHandler: AgentPromptHandler;
  private readonly skillPromptHandler: SkillPromptHandler;
  private readonly commandPromptHandler: CommandPromptHandler;
  private readonly researchCommandHandler: ResearchCommandHandler;
  private readonly compactCommandHandler: CompactCommandHandler;
  private readonly diffHandler: DiffHandler;
  private readonly artifactHandler: ArtifactHandler;
  private readonly codeBlockHandler = new CodeBlockHandler();
  private readonly analyticsHandler?: AnalyticsHandler;
  private readonly historySearchHandler: HistorySearchHandler;
  private readonly projectMemoryHandler: ProjectMemoryHandler;
  readonly historyRagFacade: HistoryRagFacade;

  constructor(
    runAgent: RunAgentUseCase,
    orchestrator: NexusOrchestrator,
    private readonly eventBus: IEventBus,
    post: (msg: ExtensionMessage) => void,
    buildProjectMap: BuildProjectMapUseCase,
    configService: ConfigService,
    detector: ProviderDetector,
    private readonly globalState: vscode.Memento,
    historyStore: IChatHistoryStore,
    extensionPath: string = '',
    extensionUri: vscode.Uri,
    subagentOrchestrator?: SubagentOrchestrator,
    workspaceState?: vscode.Memento,
    compactor?: ConversationCompactor,
    analyticsService?: AnalyticsService,
    globalStorageUri?: vscode.Uri,
    fileIntelligenceDeps?: FileIntelligenceDeps,
  ) {
    // Build history search / RAG infrastructure
    this._workspaceState = workspaceState ?? globalState;
    this._extensionUri = extensionUri;
    this._post = post;
    const historyIndexRepo = new MementoHistoryIndexRepository(workspaceState ?? globalState);
    const historyIndexBuilder = new HistoryIndexBuilder();
    const bm25Engine = new InMemoryBm25Engine();
    const bm25Strategy = new Bm25HistorySearchStrategy(bm25Engine);
    const historySearchService = new HistorySearchService(bm25Strategy, historyIndexBuilder, historyIndexRepo);
    const ragContextBuilder = new RagContextBuilder();
    this.historyRagFacade = new HistoryRagFacade(historySearchService, ragContextBuilder);
    const projectMemoryStatusService = new ProjectMemoryStatusService();
    const projectMemoryRagFacade = new ProjectMemoryRagFacade(new FsProjectMemoryIndexRepository());
    this.historySearchHandler = new HistorySearchHandler(
      this.historyRagFacade,
      post,
      () => this.historyHandler.latestHistory,
    );
    this.projectMemoryHandler = new ProjectMemoryHandler(
      post,
      buildProjectMap,
      projectMemoryStatusService,
    );

    const debugOrchestrator = createDefaultDebugOrchestrator({ eventBus, runUseCase: runAgent });
    const permissionService = new PermissionService(post as (msg: unknown) => void);
    const agentExecutor = new AgentExecutor(runAgent, eventBus, post as (msg: unknown) => void, permissionService);
    this.runTaskHandler  = new RunTaskHandler(runAgent, orchestrator, eventBus, post, buildProjectMap, extensionPath, extensionUri, workspaceState ?? globalState, subagentOrchestrator, this.historyRagFacade, debugOrchestrator, agentExecutor, permissionService, projectMemoryStatusService, projectMemoryRagFacade, fileIntelligenceDeps);
    this.historyHandler  = new HistoryHandler(post, historyStore);
    this.providerHandler = new ProviderHandler(post, detector, configService, this.globalState);
    this.reviewHandler   = new ReviewHandler(post, workspaceState);
    this.chatReviewOrchestrator = new ChatReviewOrchestrator(
      post as (msg: ExtensionMessage) => void,
      (p, pId, m, mdl, bb, hist, cc, att, sa, rt, rp) =>
        this.runTaskHandler.run(p, pId, m, mdl, bb, hist, cc, att, sa ?? false, rt, rp),
      extensionPath,
    );
    this.attachmentHandler    = new AttachmentHandler(post);
    this.loginHandler         = new LoginHandler(detector, this.providerHandler);
    this.navigationHandler    = new NavigationHandler();
    this.agentPromptHandler      = new AgentPromptHandler(extensionPath, post);
    this.skillPromptHandler      = new SkillPromptHandler(extensionPath, post);
    this.commandPromptHandler    = new CommandPromptHandler(extensionPath, post);
    this.researchCommandHandler  = new ResearchCommandHandler();
    this.compactCommandHandler   = new CompactCommandHandler(post, compactor);
    this.diffHandler             = new DiffHandler(post);
    this.artifactHandler         = new ArtifactHandler(post, workspaceState ?? globalState);

    if (analyticsService && globalStorageUri) {
      (this as unknown as { analyticsHandler?: AnalyticsHandler }).analyticsHandler = new AnalyticsHandler(
        analyticsService,
        post,
        globalStorageUri,
      );
    }

    const forwarder = new EventForwarder(post);
    const busListener = (e: Parameters<typeof forwarder.forward>[0]) => forwarder.forward(e);

    // Wire analytics lifecycle hooks into event bus
    if (analyticsService) {
      // Track final token usage per taskId so we can attach it at task_completed time
      const tokenUsageByTask = new Map<string, import('../core/tokens/TokenUsage').TokenRunUsage>();

      const analyticsListener = (event: import('../core/events/IEventBus').NexusEvent) => {
        if (event.kind === 'task_started') {
          analyticsService.recordRunStart({
            taskId: event.task.id,
            provider: event.task.agentId,
            model: event.task.model,
            mode: event.task.mode,
            startedAt: event.task.startedAt,
          });
        } else if (event.kind === 'token_usage_updated' && event.phase === 'final') {
          tokenUsageByTask.set(event.task.id, event.usage);
        } else if (event.kind === 'task_completed') {
          const usage = tokenUsageByTask.get(event.task.id);
          tokenUsageByTask.delete(event.task.id);
          void analyticsService.recordRunComplete(event.task.id, {
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            originalPromptTokens: usage?.originalPromptTokens,
            enhancedPromptTokens: usage?.enhancedPromptTokens,
            contextOverheadTokens: usage?.contextOverheadTokens,
            exitCode: event.result.exitCode,
            workspaceRoot: event.task.cwd,
          });
        } else if (event.kind === 'task_error') {
          const usage = tokenUsageByTask.get(event.task.id);
          tokenUsageByTask.delete(event.task.id);
          void analyticsService.recordRunFailed(event.task.id, {
            errorMessage: event.error,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
          });
        } else if (event.kind === 'task_stopped') {
          const usage = tokenUsageByTask.get(event.task.id);
          tokenUsageByTask.delete(event.task.id);
          void analyticsService.recordRunStopped(event.task.id, {
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
          });
        }
      };
      this.eventBus.on('*', analyticsListener);
      this.disposables.push({ dispose: () => this.eventBus.off('*', analyticsListener) });
    }

    this.eventBus.on('*', busListener);
    this.disposables.push(
      { dispose: () => this.eventBus.off('*', busListener) },
      this.loginHandler,
    );
  }

  async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this.historyHandler.load();
        await this.providerHandler.sendAvailable();
        await this.agentPromptHandler.sendAgentPrompts();
        await this.skillPromptHandler.sendSkillPrompts();
        await this.commandPromptHandler.sendCommandDefs();
        await this.projectMemoryHandler.getStatus();
        void this.historySearchHandler.ensureIndex();
        {
          const reviewHistory = this._workspaceState.get<import('../application/code-review/CodeReviewReport').CodeReviewReport[]>('nexus.review.history') ?? [];
          this._post({ type: 'reviewHistoryLoaded', reports: reviewHistory });
        }
        break;
      case 'runTask': {
        const intercepted = await this.chatReviewOrchestrator.tryIntercept(
          msg.prompt, msg.provider, msg.mode, msg.model,
          msg.attachments,
          this.historyHandler.latestHistory,
          msg.conversationContext,
          msg.subagentsEnabled ?? false,
        );
        if (!intercepted) {
          await this.runTaskHandler.run(
            msg.prompt, msg.provider, msg.mode, msg.model, msg.baseBranch,
            this.historyHandler.latestHistory,
            msg.conversationContext,
            msg.attachments, msg.subagentsEnabled ?? false,
          );
        }
        break;
      }
      case 'runCodeReview': {
        const provider = normalizeProviderId(this.globalState.get<string>('nexus.lastProvider'));
        await this.runTaskHandler.run(
          msg.userPrompt ?? '',
          provider,
          'review',
          undefined,
          msg.target.baseBranch,
          this.historyHandler.latestHistory,
          undefined,
          undefined,
          true,
          msg.target,
          msg.preset,
        );
        break;
      }
      case 'stopTask':            await this.runTaskHandler.stop(); break;
      case 'applyPlan':           await this.runTaskHandler.applyPlan(msg.mode, msg.model, msg.planPath, msg.provider); break;
      case 'rejectPlan':          await this.runTaskHandler.rejectPlan(msg.planPath); break;
      case 'openPlan':            await this.runTaskHandler.openPlan(msg.planPath); break;
      case 'openSavedPlans':      await this.runTaskHandler.openSavedPlans(); break;
      case 'saveHistory':
        await this.historyHandler.save(msg.history);
        void this.historySearchHandler.ensureIndex();
        break;
      case 'saveProvider':        await this.providerHandler.save(msg.provider); break;
      case 'getReviewContext':    await this.reviewHandler.getContext(msg.baseBranch); break;
      case 'openReviewAgentFile': await this.reviewHandler.openAgentFile(); break;
      case 'openReviewReport':
        void ReviewPanel.createOrShow(this._extensionUri, this._workspaceState, msg.report);
        break;
      case 'openReviewReportById': {
        const history = this._workspaceState.get<import('../application/code-review/CodeReviewReport').CodeReviewReport[]>('nexus.review.history', []);
        const report = history.find(r => r.id === msg.reportId);
        if (report) {
          void ReviewPanel.createOrShow(this._extensionUri, this._workspaceState, report);
        } else {
          void vscode.window.showInformationMessage('Review report not found in history (may have been cleared).');
        }
        break;
      }
      case 'resolveReviewTargetSelection':
        await this.chatReviewOrchestrator.resolveTarget(
          msg.requestId,
          msg.selectedTarget,
          this.historyHandler.latestHistory,
          undefined,
        );
        break;
      case 'cancelReviewTargetSelection':
        this.chatReviewOrchestrator.cancelTarget(msg.requestId);
        break;
      case 'openReviewFindingLocation': {
        try {
          const uri = vscode.Uri.file(msg.file);
          const doc = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(doc);
          if (msg.line !== undefined) {
            const line = Math.max(0, msg.line - 1);
            const col = msg.column !== undefined ? Math.max(0, msg.column - 1) : 0;
            const pos = new vscode.Position(line, col);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          }
        } catch {
          // non-blocking
        }
        break;
      }
      case 'pickPromptAttachment':   await this.attachmentHandler.pickAttachment(); break;
      case 'getWorkspaceFiles':      this.attachmentHandler.getWorkspaceFiles(); break;
      case 'resolveDroppedFiles':    await this.attachmentHandler.resolveDropped(msg.paths); break;
      case 'openWorkspaceFile':      await this.attachmentHandler.openFile(msg.path); break;
      case 'attachWorkspaceFiles':   this.attachmentHandler.attachWorkspaceFiles(msg.paths); break;
      case 'loginProvider':          await this.loginHandler.handle(msg.providerId); break;
      case 'openSourceControl':      await this.navigationHandler.openSourceControl(); break;
      case 'openSettings':           await this.navigationHandler.openSettings(); break;
      case 'openAbout':              await this.navigationHandler.openAbout(); break;
      case 'openExternal':           await this.navigationHandler.openExternal(msg.url); break;
      case 'getAgentPrompts':        await this.agentPromptHandler.sendAgentPrompts(); break;
      case 'reloadAgents':           await this.agentPromptHandler.reload(); break;
      case 'getSkillPrompts':        await this.skillPromptHandler.sendSkillPrompts(); break;
      case 'reloadSkills':           await this.skillPromptHandler.reload(); break;
      case 'getCommandDefs':         await this.commandPromptHandler.sendCommandDefs(); break;
      case 'reloadCommands':         await this.commandPromptHandler.reload(); break;
      case 'researchCommand':        await this.researchCommandHandler.handle(msg.action); break;
      case 'compactConversation':
        await this.compactCommandHandler.handle(
          msg.conversationId, msg.messages, msg.provider, msg.model,
        );
        break;
      // Diff viewer messages
      case 'getFileDiff':
      case 'getAllDiffs':
      case 'openDiffEditor':
      case 'openFileFromDiff':
      case 'revertFileChange':
      case 'refreshGitDiff':
        await this.diffHandler.handleMessage(msg);
        break;
      // Artifact messages
      case 'listArtifacts':
      case 'openArtifact':
      case 'previewArtifact':
      case 'revealArtifactInExplorer':
      case 'deleteArtifact':
      case 'rescanArtifacts':
        await this.artifactHandler.handleMessage(msg);
        break;
      // Code block actions
      case 'insertCodeIntoActiveFile':
      case 'createFileFromCode':
      case 'runCodeBlockCommand':
        await this.codeBlockHandler.handleMessage(msg);
        break;
      // Analytics
      case 'getAnalyticsSummary':
        await this.analyticsHandler?.getSummary(msg.query);
        break;
      case 'getAnalyticsRuns':
        await this.analyticsHandler?.getRuns(msg.query);
        break;
      case 'submitRunFeedback':
        await this.analyticsHandler?.submitFeedback(msg.taskId, msg.feedback, msg.reason);
        break;
      case 'exportAnalytics':
        await this.analyticsHandler?.export(msg.format, msg.query);
        break;
      case 'clearAnalytics':
        await this.analyticsHandler?.clear();
        break;
      // Agent Mode approval messages
      case 'approveAgentPlan':
        await this.runTaskHandler.approveAgentPlan(msg.sessionId);
        break;
      case 'rejectAgentPlan':
        await this.runTaskHandler.rejectAgentPlan_agent(msg.sessionId, msg.reason);
        break;
      case 'approveAgentCommand':
        this.runTaskHandler.approvePermission(msg.requestId);
        break;
      case 'rejectAgentCommand':
        this.runTaskHandler.rejectPermission(msg.requestId, msg.reason);
        break;
      case 'openAgentSession':
      case 'listAgentSessions':
        // These will be forwarded to the AgentExecutor when fully wired
        break;
      // Permission system messages
      case 'approvePermission':
        this.runTaskHandler.approvePermission(msg.requestId);
        break;
      case 'rejectPermission':
        this.runTaskHandler.rejectPermission(msg.requestId, msg.reason);
        break;
      case 'autoApprovePermissionScope':
        this.runTaskHandler.autoApprovePermission(msg.requestId, msg.scope);
        break;
      case 'projectMemory:getStatus':
        await this.projectMemoryHandler.getStatus();
        break;
      case 'projectMemory:getIndex':
        await this.projectMemoryHandler.getIndex();
        break;
      case 'projectMemory:rebuild':
        await this.projectMemoryHandler.rebuild();
        break;
      case 'projectMemory:clear':
        await this.projectMemoryHandler.clear();
        break;
    }
  }

  async refreshProviders(): Promise<void> {
    await this.providerHandler.refresh();
  }

  async reloadAgentPrompts(): Promise<void> {
    await this.agentPromptHandler.reload();
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
