import * as vscode from 'vscode';
import * as path from 'path';

export class AutoReviewWatcher implements vscode.Disposable {
  private readonly watcher: vscode.FileSystemWatcher;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly workspaceRoot: string,
    private readonly debounceMs: number,
    private readonly onChangeDetected: () => void,
  ) {
    const pattern = new vscode.RelativePattern(workspaceRoot, '**/*');
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcher.onDidChange(uri => this.fire(uri));
    this.watcher.onDidCreate(uri => this.fire(uri));
    this.watcher.onDidDelete(uri => this.fire(uri));
  }

  private fire(uri: vscode.Uri): void {
    const p = uri.fsPath;
    const excludes = [
      path.join(this.workspaceRoot, '.nexus'),
      path.join(this.workspaceRoot, 'node_modules'),
      path.join(this.workspaceRoot, 'dist'),
      path.join(this.workspaceRoot, 'build'),
      path.join(this.workspaceRoot, 'out'),
      path.join(this.workspaceRoot, 'media', 'webview'),
    ];
    if (excludes.some(ex => p.startsWith(ex))) return;

    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.onChangeDetected(), this.debounceMs);
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.watcher.dispose();
  }
}
