import * as vscode from 'vscode';
import { parseUnifiedDiff } from '../../git/structuredDiff';
import { getRawDiff } from '../../git/gitDiff';
import type { WebviewMessage, ExtensionMessage } from '../webviewProtocol';

export class DiffHandler {
  constructor(private readonly post: (msg: ExtensionMessage) => void) {}

  async handleMessage(msg: WebviewMessage): Promise<boolean> {
    switch (msg.type) {
      case 'getFileDiff':
        await this.handleGetFileDiff(msg.path, msg.baseRef);
        return true;
      case 'getAllDiffs':
        await this.handleGetAllDiffs(msg.baseRef);
        return true;
      case 'openDiffEditor':
        await this.handleOpenDiffEditor(msg.path);
        return true;
      case 'openFileFromDiff':
        await this.handleOpenFileFromDiff(msg.path, msg.line);
        return true;
      case 'revertFileChange':
        await this.handleRevertFileChange(msg.path);
        return true;
      case 'refreshGitDiff':
        await this.handleRefreshGitDiff();
        return true;
      default:
        return false;
    }
  }

  private async handleGetFileDiff(path: string, baseRef?: string): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        this.post({ type: 'fileDiffError', path, message: 'No workspace folder' });
        return;
      }
      const rawDiff = getRawDiff(workspaceRoot, path, baseRef);
      const diffs = parseUnifiedDiff(rawDiff);
      const diff = diffs.find(d => d.path === path || d.path.endsWith(path)) ?? diffs[0];
      if (diff) {
        this.post({ type: 'fileDiffLoaded', path, diff });
      } else {
        this.post({ type: 'fileDiffError', path, message: 'No diff found for file' });
      }
    } catch (err) {
      this.post({ type: 'fileDiffError', path, message: String(err) });
    }
  }

  private async handleGetAllDiffs(baseRef?: string): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        this.post({ type: 'fileDiffError', message: 'No workspace folder' });
        return;
      }
      const rawDiff = getRawDiff(workspaceRoot, undefined, baseRef);
      const diffs = parseUnifiedDiff(rawDiff);
      this.post({ type: 'allDiffsLoaded', diffs });
    } catch (err) {
      this.post({ type: 'fileDiffError', message: String(err) });
    }
  }

  private async handleOpenDiffEditor(path: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    const fileUri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), path);
    await vscode.commands.executeCommand('git.openChange', fileUri);
  }

  private async handleOpenFileFromDiff(path: string, line?: number): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    const fileUri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), path);
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(doc);
    if (line != null) {
      const position = new vscode.Position(Math.max(0, line - 1), 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    }
  }

  private async handleRevertFileChange(path: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    const fileUri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), path);
    await vscode.commands.executeCommand('git.revertChange', fileUri);
  }

  private async handleRefreshGitDiff(): Promise<void> {
    this.post({ type: 'gitDiffRefreshed', changedFiles: [] });
  }
}
