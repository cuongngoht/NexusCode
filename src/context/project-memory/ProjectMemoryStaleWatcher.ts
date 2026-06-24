import * as vscode from 'vscode';
import type { ProjectMemoryManifestRepository } from './ProjectMemoryManifestRepository';

export class ProjectMemoryStaleWatcher implements vscode.Disposable {
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private readonly _watchers: vscode.Disposable[];

  constructor(
    private readonly workspaceRoot: string,
    private readonly repo: ProjectMemoryManifestRepository,
    private readonly onStale: () => void,
  ) {
    const base = new vscode.RelativePattern(workspaceRoot, '**/*.{ts,tsx,js,jsx,py,go,rs,java}');
    const pkg  = new vscode.RelativePattern(workspaceRoot, '**/package.json');

    const fire = (uri: vscode.Uri) => {
      const p = uri.fsPath;
      if (p.includes('/.nexus/') || p.includes('/node_modules/') || p.includes('\\node_modules\\') || p.includes('\\.nexus\\')) return;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => { void this._markStale(); }, 30_000);
    };

    const w1 = vscode.workspace.createFileSystemWatcher(base);
    const w2 = vscode.workspace.createFileSystemWatcher(pkg);
    for (const w of [w1, w2]) {
      w.onDidChange(fire);
      w.onDidCreate(fire);
      w.onDidDelete(fire);
    }
    this._watchers = [w1, w2];
  }

  private async _markStale(): Promise<void> {
    try {
      await this.repo.markAsStale(this.workspaceRoot);
      this.onStale();
    } catch {
      // non-blocking — watcher must never crash the extension
    }
  }

  dispose(): void {
    clearTimeout(this._timer);
    this._watchers.forEach(w => w.dispose());
  }
}
