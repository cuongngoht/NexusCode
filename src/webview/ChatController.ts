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
import { buildConversationContext } from '../context/conversationContext';

export class ChatController {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly runTaskHandler: RunTaskHandler;
  private readonly historyHandler: HistoryHandler;
  private readonly providerHandler: ProviderHandler;
  private readonly reviewHandler: ReviewHandler;
  private readonly attachmentHandler: AttachmentHandler;
  private readonly loginHandler: LoginHandler;
  private readonly navigationHandler: NavigationHandler;

  constructor(
    runAgent: RunAgentUseCase,
    orchestrator: NexusOrchestrator,
    private readonly eventBus: IEventBus,
    private readonly post: (msg: ExtensionMessage) => void,
    buildProjectMap: BuildProjectMapUseCase,
    configService: ConfigService,
    private readonly detector: ProviderDetector,
    globalState: vscode.Memento,
    historyStore: IChatHistoryStore,
    extensionPath: string = '',
    subagentOrchestrator?: SubagentOrchestrator,
    workspaceState?: vscode.Memento,
  ) {
    this.runTaskHandler  = new RunTaskHandler(runAgent, orchestrator, eventBus, post, buildProjectMap, extensionPath, subagentOrchestrator);
    this.historyHandler  = new HistoryHandler(post, historyStore);
    this.providerHandler = new ProviderHandler(post, detector, configService, globalState);
    this.reviewHandler   = new ReviewHandler(post, extensionPath, workspaceState);
    this.attachmentHandler = new AttachmentHandler(post);
    this.loginHandler      = new LoginHandler(detector, this.providerHandler);
    this.navigationHandler = new NavigationHandler();

    const forwarder = new EventForwarder(post);
    const busListener = (e: Parameters<typeof forwarder.forward>[0]) => forwarder.forward(e);
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
        break;
      case 'runTask':
        await this.runTaskHandler.run(
          msg.prompt, msg.provider, msg.mode, msg.model, msg.baseBranch,
          this.historyHandler.latestHistory,
          () => buildConversationContext(this.historyHandler.latestHistory, msg.conversationId),
          msg.attachments, msg.subagentsEnabled ?? false,
        );
        break;
      case 'stopTask':            await this.runTaskHandler.stop(); break;
      case 'applyPlan':           await this.runTaskHandler.applyPlan(msg.mode, msg.model, msg.planPath, msg.provider); break;
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
    }
  }

  async refreshProviders(): Promise<void> {
    await this.providerHandler.refresh();
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
