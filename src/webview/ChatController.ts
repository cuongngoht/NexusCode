import * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage } from './webviewProtocol';
import type { IEventBus, NexusEvent } from '../core/events/IEventBus';
import { RunAgentUseCase } from '../application/usecases/RunAgentUseCase';
import { BuildProjectMapUseCase } from '../application/usecases/BuildProjectMapUseCase';
import { ProviderDetector } from '../core/providerDetector';
import { ConfigService } from '../config/ConfigService';
import type { IChatHistoryStore } from './IChatHistoryStore';
import { RunTaskHandler } from './handlers/RunTaskHandler';
import { HistoryHandler } from './handlers/HistoryHandler';
import { ProviderHandler } from './handlers/ProviderHandler';
import { ReviewHandler } from './handlers/ReviewHandler';
import { buildConversationContext } from '../context/conversationContext';

export class ChatController {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly runTaskHandler: RunTaskHandler;
  private readonly historyHandler: HistoryHandler;
  private readonly providerHandler: ProviderHandler;
  private readonly reviewHandler: ReviewHandler;

  constructor(
    runAgent: RunAgentUseCase,
    private readonly eventBus: IEventBus,
    private readonly post: (msg: ExtensionMessage) => void,
    buildProjectMap: BuildProjectMapUseCase,
    configService: ConfigService,
    detector: ProviderDetector,
    globalState: vscode.Memento,
    historyStore: IChatHistoryStore,
    extensionPath: string = '',
  ) {
    this.runTaskHandler = new RunTaskHandler(runAgent, eventBus, post, buildProjectMap, extensionPath);
    this.historyHandler = new HistoryHandler(post, historyStore);
    this.providerHandler = new ProviderHandler(post, detector, configService, globalState);
    this.reviewHandler = new ReviewHandler(post, extensionPath);

    const busListener = (event: NexusEvent) => this.forwardEvent(event);
    this.eventBus.on('*', busListener);
    this.disposables.push({ dispose: () => this.eventBus.off('*', busListener) });
  }

  async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this.historyHandler.load();
        await this.providerHandler.sendAvailable();
        break;
      case 'runTask':
        await this.runTaskHandler.run(
          msg.prompt,
          msg.provider,
          msg.mode,
          msg.model,
          msg.baseBranch,
          this.historyHandler.latestHistory,
          () => buildConversationContext(this.historyHandler.latestHistory, msg.conversationId),
        );
        break;
      case 'stopTask':
        await this.runTaskHandler.stop();
        break;
      case 'openSourceControl':
        await vscode.commands.executeCommand('workbench.view.scm');
        break;
      case 'openSettings':
        await vscode.commands.executeCommand('nexus.openSettings');
        break;
      case 'openAbout':
        await vscode.commands.executeCommand('nexus.openAbout');
        break;
      case 'saveProvider':
        await this.providerHandler.save(msg.provider);
        break;
      case 'saveHistory':
        await this.historyHandler.save(msg.history);
        break;
      case 'getReviewContext':
        await this.reviewHandler.getContext(msg.baseBranch);
        break;
      case 'openReviewAgentFile':
        await this.reviewHandler.openAgentFile();
        break;
    }
  }

  async refreshProviders(): Promise<void> {
    await this.providerHandler.refresh();
  }

  private forwardEvent(event: NexusEvent): void {
    switch (event.kind) {
      case 'task_started':
        this.post({
          type: 'taskStarted',
          taskId: event.task.id,
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
        });
        break;
      case 'stdout':
        this.post({ type: 'stdout', chunk: event.chunk });
        break;
      case 'stderr':
        this.post({ type: 'stderr', chunk: event.chunk });
        break;
      case 'task_completed':
        this.post({ type: 'taskCompleted', taskId: event.task.id, exitCode: event.result.exitCode });
        break;
      case 'task_stopped':
        this.post({ type: 'taskStopped', taskId: event.task.id });
        break;
      case 'task_error':
        this.post({ type: 'taskError', taskId: event.task.id, message: event.error });
        break;
      case 'step_started':
        this.post({
          type: 'stepStarted',
          stepLabel: event.stepLabel,
          stepIndex: event.stepIndex,
          totalSteps: event.totalSteps,
          provider: event.provider,
          mode: event.mode,
          model: event.model,
        });
        break;
      case 'step_completed':
        this.post({ type: 'stepCompleted', stepLabel: event.stepLabel });
        break;
      case 'step_error':
        this.post({ type: 'stepError', stepLabel: event.stepLabel, error: event.error });
        break;
      case 'activity_started':
        this.post({ type: 'activityStarted', activityKind: event.activityKind, label: event.label });
        break;
      case 'activity_done':
        this.post({ type: 'activityDone', activityKind: event.activityKind, label: event.label, status: event.status });
        break;
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
