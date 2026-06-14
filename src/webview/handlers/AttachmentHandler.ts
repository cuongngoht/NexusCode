import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import type { PromptAttachment } from '../../core/types';
import { listWorkspaceFiles } from '../../context/promptAttachments';
import { normalizeDroppedPath } from './workspaceUtils';

const SECRET_PATTERNS =
  /^(\.env.*|.*\.(pem|key|p12|pfx|jks)|id_rsa|id_ed25519|id_ecdsa|.*_rsa|.*_ed25519)$/i;

export class AttachmentHandler {
  constructor(private readonly post: (msg: ExtensionMessage) => void) {}

  async pickAttachment(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const choice = await vscode.window.showQuickPick(['File', 'Folder'], {
      placeHolder: 'Attach a file or folder from the workspace',
    });
    if (!choice) return;

    const isFolder = choice === 'Folder';
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: !isFolder,
      canSelectFolders: isFolder,
      canSelectMany: false,
      openLabel: `Attach ${choice}`,
      defaultUri: vscode.Uri.file(workspaceRoot),
    });
    if (!uris || uris.length === 0) return;

    const uri = uris[0];
    if (!uri.fsPath.startsWith(workspaceRoot)) {
      vscode.window.showWarningMessage('Nexus: selected path is outside the workspace and cannot be attached.');
      return;
    }

    const relPath = vscode.workspace.asRelativePath(uri, false);
    this.post({
      type: 'promptAttachmentPicked',
      attachment: { type: isFolder ? 'folder' : 'file', path: relPath },
    });
  }

  getWorkspaceFiles(): void {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) this.post({ type: 'workspaceFiles', files: listWorkspaceFiles(root) });
  }

  async resolveDropped(rawPaths: string[]): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      console.warn('[AttachmentHandler] resolveDropped: no workspace root');
      this.post({ type: 'droppedFilesResolved', attachments: [] });
      return;
    }

    const attachments: PromptAttachment[] = [];
    const skipped: string[] = [];

    for (const rawPath of rawPaths) {
      const absPath = normalizeDroppedPath(rawPath);
      const rel = path.relative(workspaceRoot, absPath);

      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
        skipped.push(`${rawPath} -> outside workspace (rel=${rel})`);
        continue;
      }
      if (SECRET_PATTERNS.test(path.basename(absPath))) {
        skipped.push(`${rawPath} -> secret file`);
        continue;
      }

      const stat = fs.statSync(absPath, { throwIfNoEntry: false });
      if (!stat) {
        skipped.push(`${rawPath} -> stat failed (not exist or no access)`);
        continue;
      }

      attachments.push({ type: stat.isDirectory() ? 'folder' : 'file', path: rel });
    }

    if (rawPaths.length > 0) {
      console.log('[AttachmentHandler] resolveDropped raw:', rawPaths, '-> attached:', attachments, 'skipped:', skipped);
    }

    if (attachments.length === 0 && rawPaths.length > 0) {
      // Give visible feedback instead of total silence
      this.post({
        type: 'taskError',
        taskId: 'attachment',
        message: `Dropped ${rawPaths.length} path(s) but none were attached (outside workspace, secrets, or inaccessible). See extension host logs for details.`,
      });
    }

    this.post({ type: 'droppedFilesResolved', attachments });
  }

  async openFile(relPath: string): Promise<void> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return;
    // If the webview sends an absolute path (e.g. from AI output), use it directly.
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
    const uri = vscode.Uri.file(fullPath);

    if (!fs.existsSync(fullPath)) {
      vscode.window.showWarningMessage(
        `Cannot open file: ${relPath}. The file does not exist (it may be a new file referenced in a plan that has not been created yet, or was filtered/skipped).`
      );
      return;
    }

    await vscode.window.showTextDocument(uri, { preview: true });
  }

  attachWorkspaceFiles(paths: string[]): void {
    const attachments: PromptAttachment[] = paths.map(p => ({ type: 'file', path: p }));
    this.post({ type: 'droppedFilesResolved', attachments });
  }
}
