import * as vscode from 'vscode';

export class LauncherViewProvider implements vscode.TreeDataProvider<never> {
  getTreeItem(): never {
    throw new Error('no items');
  }

  getChildren(): never[] {
    return [];
  }

  static register(context: vscode.ExtensionContext): void {
    const treeView = vscode.window.createTreeView('nexus.launcherView', {
      treeDataProvider: new LauncherViewProvider(),
    });

    treeView.message = 'Nexus Chat is open in the Secondary Sidebar →';

    treeView.onDidChangeVisibility(({ visible }) => {
      if (visible) {
        void vscode.commands.executeCommand('nexus.chatView.focus');
      }
    });

    context.subscriptions.push(treeView);
  }
}
