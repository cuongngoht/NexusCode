import * as vscode from 'vscode';
import { getHtml } from './getHtml';
import { AnalyticsHandler } from './handlers/AnalyticsHandler';
import type { WebviewMessage } from './webviewProtocol';
import type { AnalyticsService } from '../analytics/AnalyticsService';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'nexus.launcherView';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly analyticsService: AnalyticsService,
    private readonly globalStorageUri: vscode.Uri,
  ) {}

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

    webviewView.webview.html = getHtml(webviewView.webview, this.extensionUri, 'dashboard');

    const analyticsHandler = new AnalyticsHandler(
      this.analyticsService,
      (msg) => { webviewView.webview.postMessage(msg).then(undefined, () => {}); },
      this.globalStorageUri,
    );

    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      void this.handleMessage(msg, analyticsHandler);
    });
  }

  private async handleMessage(
    msg: WebviewMessage,
    analyticsHandler: AnalyticsHandler,
  ): Promise<void> {
    switch (msg.type) {
      case 'ready':
        break;
      case 'getAnalyticsSummary':
        await analyticsHandler.getSummary(msg.query);
        break;
      case 'getAnalyticsRuns':
        await analyticsHandler.getRuns(msg.query);
        break;
      case 'submitRunFeedback':
        await analyticsHandler.submitFeedback(msg.taskId, msg.feedback, msg.reason);
        break;
      case 'exportAnalytics':
        await analyticsHandler.export(msg.format, msg.query);
        break;
      case 'clearAnalytics':
        await analyticsHandler.clear();
        break;
    }
  }
}
