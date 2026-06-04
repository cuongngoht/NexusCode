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
