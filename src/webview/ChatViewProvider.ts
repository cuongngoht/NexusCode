import * as vscode from 'vscode';
import { getHtml } from './getHtml';
import type { WebviewMessage } from './webviewProtocol';
import type { IEventBus } from '../core/events/IEventBus';
import { RunAgentUseCase } from '../application/usecases/RunAgentUseCase';
import { NexusOrchestrator } from '../application/nexus/NexusOrchestrator';
import { BuildProjectMapUseCase } from '../application/usecases/BuildProjectMapUseCase';
import { ChatController } from './ChatController';
import { ChatHistoryStore } from './ChatHistoryStore';
import { ConfigService } from '../config/ConfigService';
import { ProviderDetector } from '../provider-hub/ProviderDetector';
import type { SubagentOrchestrator } from '../application/subagents/SubagentOrchestrator';
import type { ConversationCompactor } from '../context/ConversationCompactor';
import type { AnalyticsService } from '../analytics/AnalyticsService';
import type { CodeReviewTarget } from '../application/code-review/CodeReviewTarget';
import type { CodeReviewPreset } from '../application/code-review/CodeReviewPromptBuilder';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'nexus.chatView';

  private controller: ChatController | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly runAgent: RunAgentUseCase,
    private readonly orchestrator: NexusOrchestrator,
    private readonly eventBus: IEventBus,
    private readonly buildProjectMap: BuildProjectMapUseCase,
    private readonly configService: ConfigService,
    private readonly detector: ProviderDetector,
    private readonly globalState: vscode.Memento,
    private readonly workspaceState: vscode.Memento,
    private readonly subagentOrchestrator?: SubagentOrchestrator,
    private readonly compactor?: ConversationCompactor,
    private readonly analyticsService?: AnalyticsService,
    private readonly globalStorageUri?: vscode.Uri,
  ) { }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        vscode.Uri.joinPath(this.extensionUri, 'media', 'webview'),
      ],
    };

    webviewView.webview.html = getHtml(webviewView.webview, this.extensionUri);

    this.controller = new ChatController(
      this.runAgent,
      this.orchestrator,
      this.eventBus,
      (msg) => { webviewView.webview.postMessage(msg).then(undefined, () => { }); },
      this.buildProjectMap,
      this.configService,
      this.detector,
      this.globalState,
      new ChatHistoryStore(this.workspaceState),
      this.extensionUri.fsPath,
      this.extensionUri,
      this.subagentOrchestrator,
      this.workspaceState,
      this.compactor,
      this.analyticsService,
      this.globalStorageUri,
    );

    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      this.controller?.handleMessage(msg);
    });

    webviewView.onDidDispose(() => {
      this.controller?.dispose();
      this.controller = undefined;
    });
  }

  async refreshProviders(): Promise<void> {
    await this.controller?.refreshProviders();
  }

  async reloadAgentPrompts(): Promise<void> {
    await this.controller?.reloadAgentPrompts();
  }

  async postProjectMemoryStatusUpdate(): Promise<void> {
    await this.controller?.handleMessage({ type: 'projectMemory:getStatus' });
  }

  async runCodeReview(target: CodeReviewTarget, preset: CodeReviewPreset, userPrompt?: string): Promise<void> {
    if (!this.controller) {
      await vscode.commands.executeCommand('nexus.chatView.focus');
    }
    if (!this.controller) {
      void vscode.window.showInformationMessage('Open Nexus Chat and run the review again.');
      return;
    }
    await this.controller.handleMessage({ type: 'runCodeReview', target, preset, userPrompt });
  }
}
