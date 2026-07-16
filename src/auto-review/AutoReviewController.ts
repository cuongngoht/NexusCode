import * as vscode from 'vscode';
import * as path from 'path';
import type { CodeReviewRunnerFn } from '../application/code-review/CodeReviewExecutor';
import { AutoReviewWatcher } from './AutoReviewWatcher';
import { AutoReviewScheduler } from './AutoReviewScheduler';
import { AutoReviewStateStore } from './AutoReviewStateStore';
import { ReviewBaselineStore } from './baseline/ReviewBaselineStore';
import { readAutoReviewConfig } from './AutoReviewConfig';
import { ReviewPanel } from '../review/ReviewPanel';

export class AutoReviewController implements vscode.Disposable {
  private watcher: AutoReviewWatcher | null = null;
  private readonly scheduler: AutoReviewScheduler;
  private readonly stateStore: AutoReviewStateStore;
  private readonly baselineStore: ReviewBaselineStore;

  constructor(
    private readonly workspaceRoot: string,
    runnerFn: CodeReviewRunnerFn,
    private readonly context: vscode.ExtensionContext,
  ) {
    this.stateStore = new AutoReviewStateStore(workspaceRoot);
    this.baselineStore = new ReviewBaselineStore(workspaceRoot);
    this.scheduler = new AutoReviewScheduler(
      workspaceRoot,
      runnerFn,
      context.extensionPath,
      this.stateStore,
      this.baselineStore,
      context.extensionUri,
      context.workspaceState,
    );

    // Only start if explicitly enabled
    const cfg = readAutoReviewConfig();
    if (cfg.enabled) this.start();
  }

  start(): void {
    if (this.watcher) return;
    const cfg = readAutoReviewConfig();
    this.watcher = new AutoReviewWatcher(
      this.workspaceRoot,
      cfg.debounceMs,
      () => { void this.scheduler.trigger(); },
    );
  }

  stop(): void {
    this.watcher?.dispose();
    this.watcher = null;
  }

  async enable(): Promise<void> {
    await vscode.workspace.getConfiguration('nexus').update(
      'autoReview.enabled', true, vscode.ConfigurationTarget.Workspace,
    );
    this.start();
  }

  async disable(): Promise<void> {
    this.stop();
    await vscode.workspace.getConfiguration('nexus').update(
      'autoReview.enabled', false, vscode.ConfigurationTarget.Workspace,
    );
  }

  async runOnce(): Promise<void> {
    await this.scheduler.trigger();
  }

  async openLatest(): Promise<void> {
    const report = this.stateStore.loadLatest();
    if (!report) {
      void vscode.window.showInformationMessage('No auto-review reports found.');
      return;
    }
    if (report.codeReview) {
      await ReviewPanel.createOrShow(this.context.extensionUri, this.context.workspaceState, report.codeReview);
    } else {
      const uri = vscode.Uri.file(
        path.join(this.workspaceRoot, '.nexus', 'auto-reviews', 'latest.json'),
      );
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    }
  }

  async openHistory(): Promise<void> {
    const indexPath = path.join(this.workspaceRoot, '.nexus', 'auto-reviews', 'index.json');
    try {
      const uri = vscode.Uri.file(indexPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    } catch {
      void vscode.window.showInformationMessage('No auto-review history found.');
    }
  }

  clearHistory(): void {
    this.stateStore.clearAll();
    void vscode.window.showInformationMessage('Auto-review history cleared.');
  }

  pruneHistory(): void {
    const cfg = readAutoReviewConfig();
    this.stateStore.pruneOldReports(cfg);
    void vscode.window.showInformationMessage('Auto-review history pruned.');
  }

  onConfigurationChange(): void {
    const cfg = readAutoReviewConfig();
    // Recreate watcher to pick up debounce changes
    this.stop();
    if (cfg.enabled) this.start();
  }

  dispose(): void {
    this.stop();
  }
}
