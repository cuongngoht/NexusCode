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
    if (!workspaceRoot) return;

    const attachments: PromptAttachment[] = [];
    for (const rawPath of rawPaths) {
      const absPath = normalizeDroppedPath(rawPath);
      const rel = path.relative(workspaceRoot, absPath);
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
      if (SECRET_PATTERNS.test(path.basename(absPath))) continue;
      const stat = fs.statSync(absPath, { throwIfNoEntry: false });
      if (!stat) continue;
      attachments.push({ type: stat.isDirectory() ? 'folder' : 'file', path: rel });
    }

    this.post({ type: 'droppedFilesResolved', attachments });
  }

  async openFile(relPath: string): Promise<void> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return;
    const uri = vscode.Uri.file(path.join(root, relPath));
    await vscode.window.showTextDocument(uri, { preview: true });
  }

  attachWorkspaceFiles(paths: string[]): void {
    const attachments: PromptAttachment[] = paths.map(p => ({ type: 'file', path: p }));
    this.post({ type: 'droppedFilesResolved', attachments });
  }
}
