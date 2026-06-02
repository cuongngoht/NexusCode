import * as vscode from 'vscode';
import { getHtml } from './getHtml';
import { ExtensionMessage, WebviewMessage } from './webviewProtocol';
import { ProviderRegistry } from '../core/providerRegistry';
import { ProviderRouter } from '../core/providerRouter';
import { TaskManager } from '../core/taskManager';
import { ProcessRunner } from '../runner/processRunner';
import { globalBus } from '../core/eventBus';
import { NexusEvent } from '../core/types';
import { buildEnhancedPrompt } from '../context/promptBuilder';
import { scanWorkspace } from '../context/workspaceScanner';
import { detectPackageInfo } from '../context/packageDetector';
import { loadRules } from '../context/rulesLoader';
import { getGitStatus } from '../git/gitStatus';

export class ChatPanel {
  static readonly viewType = 'nexusChat';
  private static instance: ChatPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly taskManager: TaskManager;
  private readonly processRunner: ProcessRunner;
  private readonly router: ProviderRouter;
  private readonly registry: ProviderRegistry;
  private readonly disposables: vscode.Disposable[] = [];

  static createOrShow(
    extensionUri: vscode.Uri,
    registry: ProviderRegistry,
    taskManager: TaskManager,
    processRunner: ProcessRunner,
  ): ChatPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ChatPanel.instance) {
      ChatPanel.instance.panel.reveal(column);
      return ChatPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      ChatPanel.viewType,
      'Nexus Chat',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true,
      },
    );

    ChatPanel.instance = new ChatPanel(
      panel,
      extensionUri,
      registry,
      taskManager,
      processRunner,
    );
    return ChatPanel.instance;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    registry: ProviderRegistry,
    taskManager: TaskManager,
    processRunner: ProcessRunner,
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.taskManager = taskManager;
    this.processRunner = processRunner;
    this.registry = registry;
    this.router = new ProviderRouter(registry);

    this.panel.webview.html = getHtml(this.panel, this.extensionUri);

    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this.handleWebviewMessage(msg),
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    const busListener = (event: NexusEvent) => this.forwardEvent(event);
    globalBus.on('*', busListener);
    this.disposables.push({ dispose: () => globalBus.off('*', busListener) });
  }

  private async handleWebviewMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this.sendAvailableProviders();
        break;
      case 'runTask':
        await this.handleRunTask(msg.prompt, msg.provider, msg.mode);
        break;
      case 'stopTask':
        this.handleStopTask();
        break;
      case 'openSourceControl':
        await vscode.commands.executeCommand('workbench.view.scm');
        break;
    }
  }

  private async handleRunTask(
    prompt: string,
    providerId: import('../core/types').ProviderId,
    mode: import('../core/types').TaskMode,
  ): Promise<void> {
    if (!prompt.trim()) {
      this.sendToWebview({
        type: 'taskError',
        taskId: 'pre-task',
        message: 'Prompt must not be empty.',
      });
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.sendToWebview({
        type: 'taskError',
        taskId: 'pre-task',
        message: 'No workspace folder is open. Please open a folder first.',
      });
      return;
    }

    if (this.taskManager.hasActiveTask()) {
      this.sendToWebview({
        type: 'taskError',
        taskId: 'pre-task',
        message: 'A task is already running. Stop it first.',
      });
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    let provider: import('../core/types').CliProvider;
    try {
      provider = await this.router.resolve(providerId, mode);
    } catch (err: unknown) {
      this.sendToWebview({
        type: 'taskError',
        taskId: 'pre-task',
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const cfg = vscode.workspace.getConfiguration('nexus');
    const enhanceEnabled = cfg.get<boolean>('enablePromptEnhancement', true);

    let enhancedPrompt = prompt;
    if (enhanceEnabled) {
      const workspace = scanWorkspace(workspaceRoot);
      const packages = detectPackageInfo(workspaceRoot);
      const rules = loadRules(workspaceRoot);
      enhancedPrompt = buildEnhancedPrompt(prompt, { workspace, packages, rules, mode });
    }

    const task = this.taskManager.createTask(prompt, enhancedPrompt, provider.id, mode);

    this.sendToWebview({
      type: 'taskStarted',
      taskId: task.id,
      provider: provider.displayName,
      mode,
    });

    try {
      const command = provider.buildCommand(enhancedPrompt);
      this.processRunner.run(task.id, command, workspaceRoot);
    } catch (err: unknown) {
      this.taskManager.errorTask(
        task.id,
        err instanceof Error ? err.message : String(err),
      );
    }

    const runGitStatus = cfg.get<boolean>('runGitStatusAfterTask', true);
    if (runGitStatus) {
      const completionListener = (event: NexusEvent) => {
        if (
          (event.kind === 'task_completed' || event.kind === 'task_stopped') &&
          event.taskId === task.id
        ) {
          globalBus.off('task_completed', completionListener);
          globalBus.off('task_stopped', completionListener);
          const status = getGitStatus(workspaceRoot);
          this.sendToWebview({
            type: 'gitStatus',
            changes: status.changes,
            message: status.message,
          });
        }
      };
      globalBus.on('task_completed', completionListener);
      globalBus.on('task_stopped', completionListener);
    }
  }

  private handleStopTask(): void {
    const active = this.taskManager.getActiveTask();
    if (active) {
      this.processRunner.stop(active.id);
      this.taskManager.stopTask(active.id);
    }
  }

  private forwardEvent(event: NexusEvent): void {
    switch (event.kind) {
      case 'stdout':
        this.sendToWebview({ type: 'stdout', chunk: String(event.payload ?? '') });
        break;
      case 'stderr':
        this.sendToWebview({ type: 'stderr', chunk: String(event.payload ?? '') });
        break;
      case 'task_completed': {
        const p = event.payload as { exitCode: number } | undefined;
        this.sendToWebview({
          type: 'taskCompleted',
          taskId: event.taskId,
          exitCode: p?.exitCode ?? 0,
        });
        break;
      }
      case 'task_stopped':
        this.sendToWebview({ type: 'taskStopped', taskId: event.taskId });
        break;
      case 'task_error': {
        const p = event.payload as { message: string } | undefined;
        this.sendToWebview({
          type: 'taskError',
          taskId: event.taskId,
          message: p?.message ?? 'Unknown error',
        });
        break;
      }
    }
  }

  private sendToWebview(msg: ExtensionMessage): void {
    this.panel.webview.postMessage(msg).then(undefined, () => {
      // panel may have been disposed
    });
  }

  private async sendAvailableProviders(): Promise<void> {
    const available = await this.registry.getAvailable();
    this.sendToWebview({
      type: 'availableProviders',
      providers: available.map(p => p.id),
    });
  }

  dispose(): void {
    ChatPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
