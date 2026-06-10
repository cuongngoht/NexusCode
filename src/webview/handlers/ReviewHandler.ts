import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import { buildGitReviewContext } from '../../git/gitReviewContext';
import { ensureReviewAgentMarkdown, getReviewAgentPath } from '../../context/reviewAgentLoader';
import { requireWorkspaceRoot } from './workspaceUtils';

const SAVED_REVIEW_BASE_KEY = 'nexus.lastReviewBase';

export class ReviewHandler {
  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly extensionPath: string,
    private readonly workspaceState?: vscode.Memento,
  ) {}

  async getContext(baseBranch?: string): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post, 'reviewContextError');
    if (!workspaceRoot) return;
    try {
      const resolved = baseBranch ?? this.workspaceState?.get<string>(SAVED_REVIEW_BASE_KEY);
      const context = buildGitReviewContext(workspaceRoot, resolved);
      ensureReviewAgentMarkdown(workspaceRoot, this.extensionPath);
      if (context.baseBranch) {
        await this.workspaceState?.update(SAVED_REVIEW_BASE_KEY, context.baseBranch);
      }
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
