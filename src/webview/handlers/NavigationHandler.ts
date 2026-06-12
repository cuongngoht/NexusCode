import * as vscode from 'vscode';

export class NavigationHandler {
  async openSourceControl(): Promise<void> {
    await vscode.commands.executeCommand('workbench.view.scm');
  }

  async openSettings(): Promise<void> {
    await vscode.commands.executeCommand('nexus.openSettings');
  }

  async openAbout(): Promise<void> {
    await vscode.commands.executeCommand('nexus.openAbout');
  }

  async openExternal(url: string): Promise<void> {
    try {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } catch {
      // Ignore invalid URIs
    }
  }
}
