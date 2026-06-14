import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { ChatViewProvider } from '../ChatViewProvider';
import type { CodeReviewTarget } from '../../application/code-review/CodeReviewTarget';
import type { CodeReviewPreset } from '../../application/code-review/CodeReviewPromptBuilder';

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function postReviewMessage(
  provider: ChatViewProvider,
  target: CodeReviewTarget,
  preset: CodeReviewPreset,
): void {
  // Route through the existing webview message handler
  // The ChatController already handles runTask which will route to review mode
  // We use the direct code review flow via a dedicated message
  const panel = (provider as unknown as { controller?: { post?: (msg: unknown) => void } }).controller;
  if (panel?.post) {
    panel.post({
      type: 'runCodeReview',
      target,
      preset,
    });
  } else {
    // Fallback: open the chat and let user trigger review manually
    void vscode.commands.executeCommand('nexus.chatView.focus');
    vscode.window.showInformationMessage('Open Nexus Chat and run a Review from there.');
  }
}

/**
 * Registers the Nexus Code Review command palette commands.
 * Each command builds a CodeReviewTarget and triggers the review flow.
 */
export function registerCodeReviewCommands(
  context: vscode.ExtensionContext,
  chatProvider: ChatViewProvider,
): void {
  const cfg = () => vscode.workspace.getConfiguration('nexus');

  context.subscriptions.push(
    vscode.commands.registerCommand('nexus.review.currentBranch', () => {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const baseBranch = cfg().get<string>('review.defaultBaseBranch', 'main');
      const preset = cfg().get<CodeReviewPreset>('review.defaultPreset', 'architecture');
      const target: CodeReviewTarget = { type: 'branch', baseBranch };
      postReviewMessage(chatProvider, target, preset);
      void vscode.commands.executeCommand('nexus.chatView.focus');
    }),

    vscode.commands.registerCommand('nexus.review.workingTree', () => {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const preset = cfg().get<CodeReviewPreset>('review.defaultPreset', 'architecture');
      const target: CodeReviewTarget = { type: 'working-tree' };
      postReviewMessage(chatProvider, target, preset);
      void vscode.commands.executeCommand('nexus.chatView.focus');
    }),

    vscode.commands.registerCommand('nexus.review.staged', () => {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const preset = cfg().get<CodeReviewPreset>('review.defaultPreset', 'architecture');
      const target: CodeReviewTarget = { type: 'staged' };
      postReviewMessage(chatProvider, target, preset);
      void vscode.commands.executeCommand('nexus.chatView.focus');
    }),

    vscode.commands.registerCommand('nexus.review.currentFile', () => {
      const editor = vscode.window.activeTextEditor;
      const workspaceRoot = getWorkspaceRoot();
      if (!editor || !workspaceRoot) {
        vscode.window.showErrorMessage('No active file or workspace.');
        return;
      }
      const filePath = path.relative(workspaceRoot, editor.document.uri.fsPath);
      const preset = cfg().get<CodeReviewPreset>('review.defaultPreset', 'architecture');
      const target: CodeReviewTarget = { type: 'file', filePath };
      postReviewMessage(chatProvider, target, preset);
      void vscode.commands.executeCommand('nexus.chatView.focus');
    }),

    vscode.commands.registerCommand('nexus.review.selection', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor.');
        return;
      }
      const selectedText = editor.document.getText(editor.selection);
      if (!selectedText.trim()) {
        vscode.window.showErrorMessage('No text selected.');
        return;
      }
      const workspaceRoot = getWorkspaceRoot();
      const filePath = workspaceRoot
        ? path.relative(workspaceRoot, editor.document.uri.fsPath)
        : undefined;
      const preset = cfg().get<CodeReviewPreset>('review.defaultPreset', 'architecture');
      const target: CodeReviewTarget = { type: 'selection', selectedText, filePath };
      postReviewMessage(chatProvider, target, preset);
      void vscode.commands.executeCommand('nexus.chatView.focus');
    }),

    vscode.commands.registerCommand('nexus.review.architecture', () => {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const baseBranch = cfg().get<string>('review.defaultBaseBranch', 'main');
      const target: CodeReviewTarget = { type: 'branch', baseBranch };
      postReviewMessage(chatProvider, target, 'architecture');
      void vscode.commands.executeCommand('nexus.chatView.focus');
    }),

    vscode.commands.registerCommand('nexus.review.full', () => {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const baseBranch = cfg().get<string>('review.defaultBaseBranch', 'main');
      const target: CodeReviewTarget = { type: 'branch', baseBranch };
      postReviewMessage(chatProvider, target, 'full');
      void vscode.commands.executeCommand('nexus.chatView.focus');
    }),

    vscode.commands.registerCommand('nexus.review.exportReport', async () => {
      vscode.window.showInformationMessage('Export Review Report: open the Nexus chat and use the Export button in the review panel.');
    }),

    vscode.commands.registerCommand('nexus.review.openRules', async () => {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const rulesDir = path.join(workspaceRoot, '.nexus');
      if (!fs.existsSync(rulesDir)) {
        fs.mkdirSync(rulesDir, { recursive: true });
      }
      const reviewChecklist = path.join(rulesDir, 'review-checklist.md');
      if (!fs.existsSync(reviewChecklist)) {
        fs.writeFileSync(reviewChecklist, '# Review Checklist\n\nAdd your review rules here.\n', 'utf8');
      }
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(reviewChecklist));
      await vscode.window.showTextDocument(doc);
    }),
  );
}
