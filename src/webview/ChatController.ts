import * as vscode from 'vscode';
import { ExtensionMessage, WebviewMessage } from './webviewProtocol';
import { ProviderRegistry } from '../core/providerRegistry';
import { ProviderRouter } from '../core/providerRouter';
import { TaskManager } from '../core/taskManager';
import { ProcessRunner } from '../runner/processRunner';
import { globalBus } from '../core/eventBus';
import { NexusEvent, CliProvider, ProviderId, TaskMode } from '../core/types';
import { buildEnhancedPrompt } from '../context/promptBuilder';
import { scanWorkspace } from '../context/workspaceScanner';
import { detectPackageInfo } from '../context/packageDetector';
import { loadRules } from '../context/rulesLoader';
import { getGitStatus } from '../git/gitStatus';

export class ChatController {
  private readonly router: ProviderRouter;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly taskManager: TaskManager,
    private readonly processRunner: ProcessRunner,
    private readonly post: (msg: ExtensionMessage) => void,
  ) {
    this.router = new ProviderRouter(registry);
    const busListener = (event: NexusEvent) => this.forwardEvent(event);
    globalBus.on('*', busListener);
    this.disposables.push({ dispose: () => globalBus.off('*', busListener) });
  }

  async handleMessage(msg: WebviewMessage): Promise<void> {
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
    providerId: ProviderId,
    mode: TaskMode,
  ): Promise<void> {
    if (!prompt.trim()) {
      this.post({ type: 'taskError', taskId: 'pre-task', message: 'Prompt must not be empty.' });
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.post({
        type: 'taskError',
        taskId: 'pre-task',
        message: 'No workspace folder is open. Please open a folder first.',
      });
      return;
    }

    if (this.taskManager.hasActiveTask()) {
      this.post({
        type: 'taskError',
        taskId: 'pre-task',
        message: 'A task is already running. Stop it first.',
      });
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    let provider: CliProvider;
    try {
      provider = await this.router.resolve(providerId, mode);
    } catch (err: unknown) {
      this.post({
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

    this.post({ type: 'taskStarted', taskId: task.id, provider: provider.displayName, mode });

    try {
      const command = provider.buildCommand(enhancedPrompt);
      this.processRunner.run(task.id, command, workspaceRoot);
    } catch (err: unknown) {
      this.taskManager.errorTask(task.id, err instanceof Error ? err.message : String(err));
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
          this.post({ type: 'gitStatus', changes: status.changes, message: status.message });
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
        this.post({ type: 'stdout', chunk: String(event.payload ?? '') });
        break;
      case 'stderr':
        this.post({ type: 'stderr', chunk: String(event.payload ?? '') });
        break;
      case 'task_completed': {
        const p = event.payload as { exitCode: number } | undefined;
        this.post({ type: 'taskCompleted', taskId: event.taskId, exitCode: p?.exitCode ?? 0 });
        break;
      }
      case 'task_stopped':
        this.post({ type: 'taskStopped', taskId: event.taskId });
        break;
      case 'task_error': {
        const p = event.payload as { message: string } | undefined;
        this.post({ type: 'taskError', taskId: event.taskId, message: p?.message ?? 'Unknown error' });
        break;
      }
    }
  }

  private async sendAvailableProviders(): Promise<void> {
    const available = await this.registry.getAvailable();
    this.post({ type: 'availableProviders', providers: available.map(p => p.id) });
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
