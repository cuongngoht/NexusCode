import * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage } from './webviewProtocol';
import type { IEventBus } from '../core/events/IEventBus';
import { RunAgentUseCase } from '../application/usecases/RunAgentUseCase';
import { NexusOrchestrator } from '../application/nexus/NexusOrchestrator';
import { BuildProjectMapUseCase } from '../application/usecases/BuildProjectMapUseCase';
import { ProviderDetector } from '../core/providerDetector';
import { ConfigService } from '../config/ConfigService';
import type { IChatHistoryStore } from './IChatHistoryStore';
import { RunTaskHandler } from './handlers/RunTaskHandler';
import type { SubagentOrchestrator } from '../application/subagents/SubagentOrchestrator';
import { HistoryHandler } from './handlers/HistoryHandler';
import { ProviderHandler } from './handlers/ProviderHandler';
import { ReviewHandler } from './handlers/ReviewHandler';
import { AttachmentHandler } from './handlers/AttachmentHandler';
import { LoginHandler } from './handlers/LoginHandler';
import { NavigationHandler } from './handlers/NavigationHandler';
import { EventForwarder } from './handlers/EventForwarder';
import { AgentPromptHandler } from './handlers/AgentPromptHandler';
import { SkillPromptHandler } from './handlers/SkillPromptHandler';
import { ResearchCommandHandler } from './handlers/ResearchCommandHandler';
import { CompactCommandHandler } from './handlers/CompactCommandHandler';
import { DiffHandler } from './handlers/DiffHandler';
import { ArtifactHandler } from './handlers/ArtifactHandler';
import { CodeBlockHandler } from './handlers/CodeBlockHandler';
import { AnalyticsHandler } from './handlers/AnalyticsHandler';
import type { ConversationCompactor } from '../context/ConversationCompactor';
import type { AnalyticsService } from '../analytics/AnalyticsService';

export class ChatController {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly runTaskHandler: RunTaskHandler;
  private readonly historyHandler: HistoryHandler;
  private readonly providerHandler: ProviderHandler;
  private readonly reviewHandler: ReviewHandler;
  private readonly attachmentHandler: AttachmentHandler;
  private readonly loginHandler: LoginHandler;
  private readonly navigationHandler: NavigationHandler;
  private readonly agentPromptHandler: AgentPromptHandler;
  private readonly skillPromptHandler: SkillPromptHandler;
  private readonly researchCommandHandler: ResearchCommandHandler;
  private readonly compactCommandHandler: CompactCommandHandler;
  private readonly diffHandler: DiffHandler;
  private readonly artifactHandler: ArtifactHandler;
  private readonly codeBlockHandler = new CodeBlockHandler();
  private readonly analyticsHandler?: AnalyticsHandler;

  constructor(
    runAgent: RunAgentUseCase,
    orchestrator: NexusOrchestrator,
    private readonly eventBus: IEventBus,
    post: (msg: ExtensionMessage) => void,
    buildProjectMap: BuildProjectMapUseCase,
    configService: ConfigService,
    detector: ProviderDetector,
    globalState: vscode.Memento,
    historyStore: IChatHistoryStore,
    extensionPath: string = '',
    subagentOrchestrator?: SubagentOrchestrator,
    workspaceState?: vscode.Memento,
    compactor?: ConversationCompactor,
    analyticsService?: AnalyticsService,
    globalStorageUri?: vscode.Uri,
  ) {
    this.runTaskHandler  = new RunTaskHandler(runAgent, orchestrator, eventBus, post, buildProjectMap, extensionPath, subagentOrchestrator);
    this.historyHandler  = new HistoryHandler(post, historyStore);
    this.providerHandler = new ProviderHandler(post, detector, configService, globalState);
    this.reviewHandler   = new ReviewHandler(post, extensionPath, workspaceState);
    this.attachmentHandler    = new AttachmentHandler(post);
    this.loginHandler         = new LoginHandler(detector, this.providerHandler);
    this.navigationHandler    = new NavigationHandler();
    this.agentPromptHandler      = new AgentPromptHandler(extensionPath, post);
    this.skillPromptHandler      = new SkillPromptHandler(extensionPath, post);
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
        break;
      case 'runTask':
        await this.runTaskHandler.run(
          msg.prompt, msg.provider, msg.mode, msg.model, msg.baseBranch,
          this.historyHandler.latestHistory,
          msg.conversationContext,
          msg.attachments, msg.subagentsEnabled ?? false,
        );
        break;
      case 'stopTask':            await this.runTaskHandler.stop(); break;
      case 'applyPlan':           await this.runTaskHandler.applyPlan(msg.mode, msg.model, msg.planPath, msg.provider); break;
      case 'rejectPlan':          await this.runTaskHandler.rejectPlan(msg.planPath); break;
      case 'openPlan':            await this.runTaskHandler.openPlan(msg.planPath); break;
      case 'openSavedPlans':      await this.runTaskHandler.openSavedPlans(); break;
      case 'saveHistory':         await this.historyHandler.save(msg.history); break;
      case 'saveProvider':        await this.providerHandler.save(msg.provider); break;
      case 'getReviewContext':    await this.reviewHandler.getContext(msg.baseBranch); break;
      case 'openReviewAgentFile': await this.reviewHandler.openAgentFile(); break;
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
