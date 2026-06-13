import * as vscode from 'vscode';

interface LauncherItem {
  id: string;
  label: string;
  description?: string;
  command?: string;
  icon?: string;
}

export class LauncherViewProvider implements vscode.TreeDataProvider<LauncherItem> {
  private readonly items: LauncherItem[] = [
    {
      id: 'open-chat',
      label: 'Open Chat',
      description: 'Start chatting with Nexus agents',
      command: 'nexus.openChat',
      icon: 'comment-discussion',
    },
    {
      id: 'open-settings',
      label: 'Open Settings',
      description: 'Configure providers & options',
      command: 'nexus.openSettings',
      icon: 'settings-gear',
    },
    {
      id: 'help',
      label: 'How to use',
      description: 'Chat appears in the Secondary Sidebar',
      icon: 'question',
    },
  ];

  getTreeItem(element: LauncherItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.description;
    if (element.icon) {
      item.iconPath = new vscode.ThemeIcon(element.icon);
    }
    if (element.command) {
      item.command = {
        command: element.command,
        title: element.label,
      };
    }
    return item;
  }

  getChildren(): LauncherItem[] {
    return this.items;
  }

  static register(context: vscode.ExtensionContext): void {
    const provider = new LauncherViewProvider();
    const treeView = vscode.window.createTreeView('nexus.launcherView', {
      treeDataProvider: provider,
    });

    // Auto-focus the real chat when the launcher becomes visible
    treeView.onDidChangeVisibility(({ visible }) => {
      if (visible) {
        void vscode.commands.executeCommand('nexus.chatView.focus');
      }
    });

    // Also focus chat when user clicks the launcher view container
    treeView.onDidChangeSelection(() => {
      // If they clicked a non-command item, still try to surface the chat
      void vscode.commands.executeCommand('nexus.chatView.focus');
    });

    context.subscriptions.push(treeView);

    // Ensure chat can be opened directly from the launcher area
    context.subscriptions.push(
      vscode.commands.registerCommand('nexus.launcher.openChat', () => {
        void vscode.commands.executeCommand('nexus.chatView.focus');
      }),
    );
  }
}
