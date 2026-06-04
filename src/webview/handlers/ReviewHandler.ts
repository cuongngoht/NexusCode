import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import { buildGitReviewContext } from '../../git/gitReviewContext';
import { ensureReviewAgentMarkdown, getReviewAgentPath } from '../../context/reviewAgentLoader';
import { requireWorkspaceRoot } from './workspaceUtils';

export class ReviewHandler {
  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly extensionPath: string,
  ) {}

  async getContext(baseBranch?: string): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post, 'reviewContextError');
    if (!workspaceRoot) return;
    try {
      const context = buildGitReviewContext(workspaceRoot, baseBranch);
      ensureReviewAgentMarkdown(workspaceRoot, this.extensionPath);
      this.post({ type: 'reviewContext', context });
    } catch (err) {
      this.post({ type: 'reviewContextError', message: String(err) });
    }
  }

  async openAgentFile(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post, 'reviewContextError');
    if (!workspaceRoot) return;
    try {
      const filePath = getReviewAgentPath(workspaceRoot);
      ensureReviewAgentMarkdown(workspaceRoot, this.extensionPath);
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc);
    } catch (err) {
      this.post({ type: 'reviewContextError', message: String(err) });
    }
  }
}
