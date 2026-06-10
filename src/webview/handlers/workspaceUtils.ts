import * as path from 'path';
import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';

export function requireWorkspaceRoot(
  post: (msg: ExtensionMessage) => void,
  errorType: 'taskError' | 'reviewContextError' = 'taskError',
): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    const message = 'No workspace folder is open. Please open a folder first.';
    if (errorType === 'reviewContextError') {
      post({ type: 'reviewContextError', message });
    } else {
      post({ type: 'taskError', taskId: 'pre-task', message });
    }
    return null;
  }
  return folders[0].uri.fsPath;
}

/** Normalise a dropped path: strip file:// URI prefix, decode percent-encoding. */
export function normalizeDroppedPath(raw: string): string {
  let p = raw.trim();
  if (p.startsWith('file:///')) {
    p = p.slice(process.platform === 'win32' ? 8 : 7);
  } else if (p.startsWith('file://')) {
    p = p.slice(7);
  }
  try { p = decodeURIComponent(p); } catch { /* ignore */ }
  return path.normalize(p);
}
