import * as vscode from 'vscode';
import { getHtml } from './getHtml';
import { WebviewMessage } from './webviewProtocol';
import { ProviderRegistry } from '../core/providerRegistry';
import { TaskManager } from '../core/taskManager';
import { ProcessRunner } from '../runner/processRunner';
import { ChatController } from './ChatController';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'nexus.chatView';

  private controller: ChatController | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly registry: ProviderRegistry,
    private readonly taskManager: TaskManager,
    private readonly processRunner: ProcessRunner,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };

    webviewView.webview.html = getHtml(webviewView.webview, this.extensionUri);

    this.controller = new ChatController(
      this.registry,
      this.taskManager,
      this.processRunner,
      (msg) => { webviewView.webview.postMessage(msg).then(undefined, () => {}); },
    );

    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      this.controller?.handleMessage(msg);
    });

    webviewView.onDidDispose(() => {
      this.controller?.dispose();
      this.controller = undefined;
    });
  }
}
