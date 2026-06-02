import * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage } from './webviewProtocol';
import type { IEventBus, NexusEvent } from '../core/events/IEventBus';
import type { ProviderId, TaskMode } from '../core/types';
import { AgentTask } from '../core/agent';
import { RunAgentUseCase } from '../application/usecases/RunAgentUseCase';
import { ProviderDetector } from '../core/providerDetector';
import { buildEnhancedPrompt } from '../context/promptBuilder';
import { scanWorkspace } from '../context/workspaceScanner';
import { detectPackageInfo } from '../context/packageDetector';
import { loadRules } from '../context/rulesLoader';
import { getGitStatus } from '../git/gitStatus';

export class ChatController {
  private readonly detector: ProviderDetector;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly runAgent: RunAgentUseCase,
    private readonly eventBus: IEventBus,
    private readonly post: (msg: ExtensionMessage) => void,
  ) {
    this.detector = new ProviderDetector();
    const busListener = (event: NexusEvent) => this.forwardEvent(event);
    this.eventBus.on('*', busListener);
    this.disposables.push({ dispose: () => this.eventBus.off('*', busListener) });
  }

  async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this.sendAvailableProviders();
        break;
      case 'runTask':
        await this.handleRunTask(msg.prompt, msg.provider, msg.mode, msg.model);
        break;
      case 'stopTask':
        await this.handleStopTask();
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
    model?: string,
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

    if (this.runAgent.hasActiveTask()) {
      this.post({
        type: 'taskError',
        taskId: 'pre-task',
        message: 'A task is already running. Stop it first.',
      });
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cfg = vscode.workspace.getConfiguration('nexus');
    const enhanceEnabled = cfg.get<boolean>('enablePromptEnhancement', true);

    let enhancedPrompt = prompt;
    if (enhanceEnabled) {
      const workspace = scanWorkspace(workspaceRoot);
      const packages = detectPackageInfo(workspaceRoot);
      const rules = loadRules(workspaceRoot);
      enhancedPrompt = buildEnhancedPrompt(prompt, { workspace, packages, rules, mode });
    }

    const task = new AgentTask(
      prompt,
      enhancedPrompt,
      providerId,
      mode,
      model?.trim() || undefined,
      workspaceRoot,
    );

    const runGitStatus = cfg.get<boolean>('runGitStatusAfterTask', true);
    if (runGitStatus) {
      const gitListener = (event: NexusEvent) => {
        if (
          (event.kind === 'task_completed' || event.kind === 'task_stopped') &&
          event.task.id === task.id
        ) {
          this.eventBus.off('task_completed', gitListener);
          this.eventBus.off('task_stopped', gitListener);
          const status = getGitStatus(workspaceRoot);
          this.post({ type: 'gitStatus', changes: status.changes, message: status.message });
        }
      };
      this.eventBus.on('task_completed', gitListener);
      this.eventBus.on('task_stopped', gitListener);
    }

    try {
      await this.runAgent.execute(task);
    } catch {
      // errors are emitted via eventBus → forwardEvent handles them
    }
  }

  private async handleStopTask(): Promise<void> {
    await this.runAgent.stop();
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
        this.post({
          type: 'taskCompleted',
          taskId: event.task.id,
          exitCode: event.result.exitCode,
        });
        break;
      case 'task_stopped':
        this.post({ type: 'taskStopped', taskId: event.task.id });
        break;
      case 'task_error':
        this.post({ type: 'taskError', taskId: event.task.id, message: event.error });
        break;
    }
  }

  private async sendAvailableProviders(): Promise<void> {
    const detection = await this.detector.detectAll();
    const providers = detection.filter(d => d.installed).map(d => d.id);
    this.post({ type: 'availableProviders', providers, detection });
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
