import * as vscode from 'vscode';
import { getHtml } from './getHtml';
import type { WebviewMessage } from './webviewProtocol';
import type { IEventBus } from '../core/events/IEventBus';
import { RunAgentUseCase } from '../application/usecases/RunAgentUseCase';
import { BuildProjectMapUseCase } from '../application/usecases/BuildProjectMapUseCase';
import { ChatController } from './ChatController';
import { ConfigService } from '../config/ConfigService';
import { ProviderDetector } from '../core/providerDetector';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'nexus.chatView';

  private controller: ChatController | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly runAgent: RunAgentUseCase,
    private readonly eventBus: IEventBus,
    private readonly buildProjectMap: BuildProjectMapUseCase,
    private readonly configService: ConfigService,
    private readonly detector: ProviderDetector,
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
      this.eventBus,
      (msg) => { webviewView.webview.postMessage(msg).then(undefined, () => { }); },
      this.buildProjectMap,
      this.configService,
      this.detector,
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
}
