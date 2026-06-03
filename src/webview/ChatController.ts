import * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage } from './webviewProtocol';
import type { IEventBus, NexusEvent } from '../core/events/IEventBus';
import type { ProviderId, TaskMode } from '../core/types';
import { AgentTask } from '../core/agent';
import { RunAgentUseCase } from '../application/usecases/RunAgentUseCase';
import { BuildProjectMapUseCase } from '../application/usecases/BuildProjectMapUseCase';
import { createPreSteps } from '../application/pipeline/createPreSteps';
import type { PipelineContext } from '../core/pipeline/PipelineContext';
import { ProviderDetector } from '../core/providerDetector';
import { ConfigService } from '../config/ConfigService';
import { buildEnhancedPrompt } from '../context/promptBuilder';
import { scanWorkspace } from '../context/workspaceScanner';
import { detectPackageInfo } from '../context/packageDetector';
import { loadRules } from '../context/rulesLoader';
import { getGitStatus } from '../git/gitStatus';
import { buildGitReviewContext } from '../git/gitReviewContext';
import { ensureReviewAgentMarkdown, loadReviewAgentMarkdown, getReviewAgentPath } from '../context/reviewAgentLoader';
import { buildReviewPrompt } from '../context/reviewPromptBuilder';
import { ChatHistoryStore } from './ChatHistoryStore';
import type { ChatHistoryState, SerializedChatMessage } from '../core/chat/ChatHistory';

const SCAN_PROJECT_DEFAULT =
  "Summarize this project's architecture, detected units, tech stack, and suggest next steps.";

const REVIEW_DEFAULT =
  'Review the current branch against the selected base branch. Focus on bugs, regressions, security, tests, and maintainability.';

const RUN_STEP_LABEL = 'analyze';

const SAVED_PROVIDER_KEY = 'nexus.lastProvider';

const CONTEXT_CHAR_LIMIT = 12_000;
const CONTEXT_MAX_MESSAGES = 8;

export class ChatController {
  private readonly disposables: vscode.Disposable[] = [];
  private _pipelineActive = false;
  private readonly historyStore: ChatHistoryStore;
  private _latestHistory: ChatHistoryState | null = null;

  constructor(
    private readonly runAgent: RunAgentUseCase,
    private readonly eventBus: IEventBus,
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly buildProjectMap: BuildProjectMapUseCase,
    private readonly configService: ConfigService,
    private readonly detector: ProviderDetector,
    private readonly globalState: vscode.Memento,
    workspaceState: vscode.Memento,
    private readonly extensionPath: string = '',
  ) {
    this.historyStore = new ChatHistoryStore(workspaceState);
    const busListener = (event: NexusEvent) => this.forwardEvent(event);
    this.eventBus.on('*', busListener);
    this.disposables.push({ dispose: () => this.eventBus.off('*', busListener) });
  }

  async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this.loadAndSendHistory();
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
      case 'openSettings':
        await vscode.commands.executeCommand('nexus.openSettings');
        break;
      case 'openAbout':
        await vscode.commands.executeCommand('nexus.openAbout');
        break;
      case 'saveProvider':
        await this.globalState.update(SAVED_PROVIDER_KEY, msg.provider);
        break;
      case 'saveHistory':
        this._latestHistory = msg.history;
        await this.historyStore.save(msg.history);
        break;
      case 'getReviewContext':
        await this.handleGetReviewContext(msg.baseBranch);
        break;
      case 'openReviewAgentFile':
        await this.handleOpenReviewAgentFile();
        break;
    }
  }

  private async handleRunTask(
    prompt: string,
    providerId: ProviderId,
    mode: TaskMode,
    model?: string,
  ): Promise<void> {
    if (!prompt.trim() && mode !== 'scan-project' && mode !== 'review') {
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

    if (this.runAgent.hasActiveTask() || this._pipelineActive) {
      this.post({
        type: 'taskError',
        taskId: 'pre-task',
        message: 'A task is already running. Stop it first.',
      });
      return;
    }

    const effectivePrompt =
      prompt.trim() ||
      (mode === 'review' ? REVIEW_DEFAULT : SCAN_PROJECT_DEFAULT);
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cfg = vscode.workspace.getConfiguration('nexus');
    const enableEnhancement = cfg.get<boolean>('enablePromptEnhancement', true);

    const conversationContext = this._latestHistory
      ? this.buildConversationContext(this._latestHistory)
      : undefined;

    const ctx: PipelineContext = {
      workspaceRoot,
      originalPrompt: effectivePrompt,
      mode,
      model,
      providerId,
      enableEnhancement,
      enhancedPrompt: effectivePrompt,
      conversationContext,
    };

    const preSteps = createPreSteps(mode, { buildProjectMap: this.buildProjectMap });
    const totalSteps = preSteps.length + 1; // +1 for run-agent step

    this._pipelineActive = true;
    try {
      // Run pre-steps (emit step events, enrich ctx)
      for (let i = 0; i < preSteps.length; i++) {
        const step = preSteps[i];
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
          this.post({
            type: 'taskError',
            taskId: 'pipeline',
            message: `${step.label} failed: ${String(err)}`,
          });
          return;
        }
        this.eventBus.emit({ kind: 'step_completed', stepLabel: step.label });
      }

      // Build enhanced prompt after pre-steps
      if (enableEnhancement) {
        const workspace = scanWorkspace(workspaceRoot);
        const packages = detectPackageInfo(workspaceRoot);
        const rules = loadRules(workspaceRoot);
        const basePrompt = buildEnhancedPrompt(ctx.originalPrompt, {
          workspace,
          packages,
          rules,
          mode,
          projectMap: ctx.projectMap,
          conversationContext: ctx.conversationContext,
        });

        if (mode === 'review') {
          const reviewContext = buildGitReviewContext(workspaceRoot);
          const reviewAgentMarkdown = loadReviewAgentMarkdown(workspaceRoot, this.extensionPath);
          ctx.enhancedPrompt = buildReviewPrompt({
            userPrompt: ctx.originalPrompt,
            reviewAgentMarkdown,
            reviewContext,
            baseWorkspacePrompt: basePrompt,
          });
        } else {
          ctx.enhancedPrompt = basePrompt;
        }
      }

      // Emit run-agent step (creates AssistantMessage if no pre-steps ran)
      this.eventBus.emit({
        kind: 'step_started',
        stepLabel: RUN_STEP_LABEL,
        stepIndex: preSteps.length,
        totalSteps,
        provider: String(providerId),
        mode: String(mode),
        model,
      });

      // Create task with final enhanced prompt
      const task = new AgentTask(
        ctx.originalPrompt,
        ctx.enhancedPrompt,
        providerId,
        mode,
        model?.trim() || undefined,
        workspaceRoot,
      );

      // Setup git status listener
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
        this.eventBus.emit({ kind: 'step_completed', stepLabel: RUN_STEP_LABEL });
      } catch {
        this.eventBus.emit({ kind: 'step_error', stepLabel: RUN_STEP_LABEL, error: '' });
        // task_error already emitted by runAgent and forwarded via forwardEvent
      }
    } finally {
      this._pipelineActive = false;
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

  private async loadAndSendHistory(): Promise<void> {
    try {
      const history = this.historyStore.load();
      if (history) {
        this._latestHistory = history;
        this.post({ type: 'historyLoaded', history });
      }
    } catch (err) {
      this.post({ type: 'historyError', message: String(err) });
    }
  }

  private buildConversationContext(history: ChatHistoryState): string | undefined {
    const conv = history.conversations.find(c => c.id === history.activeConversationId);
    if (!conv || conv.messages.length === 0) return undefined;

    const messages = conv.messages.slice(-CONTEXT_MAX_MESSAGES);
    const lines: string[] = [];
    let chars = 0;

    for (const m of messages) {
      let text: string;
      if (m.role === 'user') {
        text = `User: ${(m as Extract<SerializedChatMessage, { role: 'user' }>).prompt}`;
      } else {
        const a = m as Extract<SerializedChatMessage, { role: 'assistant' }>;
        const snippet = a.content.slice(0, 2000);
        text = `Assistant: ${snippet}`;
      }
      lines.push(text);
      chars += text.length;
      if (chars >= CONTEXT_CHAR_LIMIT) break;
    }

    return lines.length > 0 ? lines.join('\n') : undefined;
  }

  private async sendAvailableProviders(): Promise<void> {
    const detection = await this.detector.detectAll();
    const configured = await this.configService.hasConfig();
    if (!configured) {
      this.post({ type: 'availableProviders', providers: [], detection, needsSetup: true });
      await vscode.commands.executeCommand('nexus.openSettings');
      return;
    }
    const config = await this.configService.loadConfig();
    const providers = detection
      .filter(d => d.installed && config.providers[d.id as keyof typeof config.providers]?.enabled)
      .map(d => d.id);
    const savedProvider = this.globalState.get<string>(SAVED_PROVIDER_KEY);
    this.post({ type: 'availableProviders', providers, detection, needsSetup: false, savedProvider });
  }

  async refreshProviders(): Promise<void> {
    await this.sendAvailableProviders();
  }

  private async handleGetReviewContext(baseBranch?: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.post({ type: 'reviewContextError', message: 'No workspace folder is open.' });
      return;
    }

    try {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const context = buildGitReviewContext(workspaceRoot, baseBranch);
      ensureReviewAgentMarkdown(workspaceRoot, this.extensionPath);
      this.post({ type: 'reviewContext', context });
    } catch (err) {
      this.post({ type: 'reviewContextError', message: String(err) });
    }
  }

  private async handleOpenReviewAgentFile(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.post({ type: 'reviewContextError', message: 'No workspace folder is open.' });
      return;
    }

    try {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const filePath = getReviewAgentPath(workspaceRoot);
      ensureReviewAgentMarkdown(workspaceRoot, this.extensionPath);
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc);
    } catch (err) {
      this.post({ type: 'reviewContextError', message: String(err) });
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
