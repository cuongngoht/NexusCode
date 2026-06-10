import * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage } from './webviewProtocol';
import type { IEventBus, NexusEvent } from '../core/events/IEventBus';
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
import { buildConversationContext } from '../context/conversationContext';
import { listWorkspaceFiles } from '../context/promptAttachments';

export class ChatController {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly runTaskHandler: RunTaskHandler;
  private readonly historyHandler: HistoryHandler;
  private readonly providerHandler: ProviderHandler;
  private readonly reviewHandler: ReviewHandler;

  constructor(
    runAgent: RunAgentUseCase,
    orchestrator: NexusOrchestrator,
    private readonly eventBus: IEventBus,
    private readonly post: (msg: ExtensionMessage) => void,
    buildProjectMap: BuildProjectMapUseCase,
    configService: ConfigService,
    detector: ProviderDetector,
    globalState: vscode.Memento,
    historyStore: IChatHistoryStore,
    extensionPath: string = '',
    subagentOrchestrator?: SubagentOrchestrator,
    workspaceState?: vscode.Memento,
  ) {
    this.runTaskHandler = new RunTaskHandler(runAgent, orchestrator, eventBus, post, buildProjectMap, extensionPath, subagentOrchestrator);
    this.historyHandler = new HistoryHandler(post, historyStore);
    this.providerHandler = new ProviderHandler(post, detector, configService, globalState);
    this.reviewHandler = new ReviewHandler(post, extensionPath, workspaceState);

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
          msg.attachments,
          msg.subagentsEnabled ?? false,
        );
        break;
      case 'pickPromptAttachment':
        await this.handlePickAttachment();
        break;
      case 'getWorkspaceFiles': {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (root) this.post({ type: 'workspaceFiles', files: listWorkspaceFiles(root) });
        break;
      }
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
      case 'applyPlan':
        await this.runTaskHandler.applyPlan(msg.mode, msg.model, msg.planPath, msg.provider);
        break;
      case 'openPlan':
        await this.runTaskHandler.openPlan(msg.planPath);
        break;
      case 'openSavedPlans':
        await this.runTaskHandler.openSavedPlans();
        break;
      case 'loginProvider':
        await this.handleLoginProvider(msg.providerId);
        break;
    }
  }

  async refreshProviders(): Promise<void> {
    await this.providerHandler.refresh();
  }

  private readonly LOGIN_COMMANDS: Partial<Record<string, string>> = {
    claude: 'claude',
    antigravity: 'agy',
    copilot: 'gh auth login',
    grok: 'grok auth',
  };

  private async handleLoginProvider(providerId: string): Promise<void> {
    const command = this.LOGIN_COMMANDS[providerId];
    if (!command) return;
    const terminal = vscode.window.createTerminal({ name: `NexusCode: Login ${providerId}` });
    terminal.sendText(command);
    terminal.show();
    const disposable = vscode.window.onDidCloseTerminal(t => {
      if (t === terminal) {
        disposable.dispose();
        void this.providerHandler.refresh();
      }
    });
    this.disposables.push(disposable);
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
          enhancedPrompt: event.task.enhancedPrompt,
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
      case 'token_usage_updated':
        this.post({
          type: 'tokenUsageUpdated',
          taskId: event.task.id,
          phase: event.phase,
          usage: event.usage,
        });
        break;
      case 'plan_saved':
        this.post({ type: 'planSaved', taskId: event.task.id, planPath: event.planPath });
        break;
    }
  }

  private async handlePickAttachment(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const choice = await vscode.window.showQuickPick(['File', 'Folder'], {
      placeHolder: 'Attach a file or folder from the workspace',
    });
    if (!choice) return;

    const isFolder = choice === 'Folder';
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: !isFolder,
      canSelectFolders: isFolder,
      canSelectMany: false,
      openLabel: `Attach ${choice}`,
      defaultUri: vscode.Uri.file(workspaceRoot),
    });
    if (!uris || uris.length === 0) return;

    const uri = uris[0];
    if (!uri.fsPath.startsWith(workspaceRoot)) {
      vscode.window.showWarningMessage('Nexus: selected path is outside the workspace and cannot be attached.');
      return;
    }

    const relPath = vscode.workspace.asRelativePath(uri, false);
    this.post({
      type: 'promptAttachmentPicked',
      attachment: { type: isFolder ? 'folder' : 'file', path: relPath },
    });
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
