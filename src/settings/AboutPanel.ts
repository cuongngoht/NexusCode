import * as vscode from 'vscode';
import { getAboutHtml } from './AboutHtml';

export class AboutPanel {
  static readonly viewType = 'nexus.about';
  private static instance: AboutPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri): void {
    if (AboutPanel.instance) {
      AboutPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      AboutPanel.viewType,
      'About Nexus Code',
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    AboutPanel.instance = new AboutPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri) {
    this.panel = panel;
    this.panel.webview.html = getAboutHtml(this.panel.webview);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  dispose(): void {
    AboutPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) { d.dispose(); }
    this.disposables.length = 0;
  }
}
