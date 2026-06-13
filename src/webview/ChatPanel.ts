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

export class ChatPanel {
  static readonly viewType = 'nexusChat';
  private static instance: ChatPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly controller: ChatController;
  private readonly disposables: vscode.Disposable[] = [];

  static createOrShow(
    extensionUri: vscode.Uri,
    runAgent: RunAgentUseCase,
    orchestrator: NexusOrchestrator,
    eventBus: IEventBus,
    buildProjectMap: BuildProjectMapUseCase,
    configService: ConfigService,
    detector: ProviderDetector,
    globalState: vscode.Memento,
    workspaceState: vscode.Memento,
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
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'media', 'webview'),
        ],
        retainContextWhenHidden: true,
      },
    );

    ChatPanel.instance = new ChatPanel(panel, extensionUri, runAgent, orchestrator, eventBus, buildProjectMap, configService, detector, globalState, workspaceState);
    return ChatPanel.instance;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    runAgent: RunAgentUseCase,
    orchestrator: NexusOrchestrator,
    eventBus: IEventBus,
    buildProjectMap: BuildProjectMapUseCase,
    configService: ConfigService,
    detector: ProviderDetector,
    globalState: vscode.Memento,
    workspaceState: vscode.Memento,
  ) {
    this.panel = panel;
    this.controller = new ChatController(
      runAgent,
      orchestrator,
      eventBus,
      (msg: Parameters<typeof this.panel.webview.postMessage>[0]) => { this.panel.webview.postMessage(msg).then(undefined, () => { }); },
      buildProjectMap,
      configService,
      detector,
      globalState,
      new ChatHistoryStore(workspaceState),
    );

    this.panel.webview.html = getHtml(this.panel.webview, extensionUri);

    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this.controller.handleMessage(msg),
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  dispose(): void {
    ChatPanel.instance = undefined;
    this.controller.dispose();
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
