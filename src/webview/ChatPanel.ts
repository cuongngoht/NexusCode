import * as vscode from 'vscode';
import { getHtml } from './getHtml';
import { WebviewMessage } from './webviewProtocol';
import { ProviderRegistry } from '../core/providerRegistry';
import { TaskManager } from '../core/taskManager';
import { ProcessRunner } from '../runner/processRunner';
import { ChatController } from './ChatController';

export class ChatPanel {
  static readonly viewType = 'nexusChat';
  private static instance: ChatPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly controller: ChatController;
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
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'media', 'webview'),
        ],
        retainContextWhenHidden: true,
      },
    );

    ChatPanel.instance = new ChatPanel(panel, extensionUri, registry, taskManager, processRunner);
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
    this.controller = new ChatController(
      registry,
      taskManager,
      processRunner,
      (msg) => { this.panel.webview.postMessage(msg).then(undefined, () => {}); },
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
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
