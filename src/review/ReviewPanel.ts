import * as vscode from 'vscode';
import type { CodeReviewReport } from '../application/code-review/CodeReviewReport';
import { getReviewHtml } from './ReviewHtml';

export class ReviewPanel {
  static readonly viewType = 'nexus.review';
  private static instance: ReviewPanel | undefined;

  private static readonly HISTORY_KEY = 'nexus.review.history';
  private static readonly MAX_HISTORY = 10;

  private readonly panel: vscode.WebviewPanel;
  private readonly workspaceState: vscode.Memento;
  private readonly disposables: vscode.Disposable[] = [];
  private currentReport: CodeReviewReport | null = null;

  static async createOrShow(
    extensionUri: vscode.Uri,
    workspaceState: vscode.Memento,
    report: CodeReviewReport,
    columnStr?: string,
  ): Promise<void> {
    const column = columnStr === 'One' ? vscode.ViewColumn.One
      : columnStr === 'Active' ? vscode.ViewColumn.Active
      : vscode.ViewColumn.Two;

    if (ReviewPanel.instance) {
      ReviewPanel.instance.panel.reveal(column);
      await ReviewPanel.instance.updateReport(report);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      ReviewPanel.viewType,
      'Code Review Report',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    ReviewPanel.instance = new ReviewPanel(panel, extensionUri, workspaceState, report);
  }

  static async showLatest(
    extensionUri: vscode.Uri,
    workspaceState: vscode.Memento,
  ): Promise<void> {
    const report = workspaceState.get<CodeReviewReport>('nexus.review.latestReport');
    if (!report) {
      vscode.window.showInformationMessage('No recent code review report found.');
      return;
    }
    await ReviewPanel.createOrShow(extensionUri, workspaceState, report);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    _extensionUri: vscode.Uri,
    workspaceState: vscode.Memento,
    report: CodeReviewReport,
  ) {
    this.panel = panel;
    this.workspaceState = workspaceState;
    this.currentReport = report;

    this.updateHtml();
    void this.persistReport(report);

    this.panel.webview.onDidReceiveMessage(
      (msg: unknown) => { void this._handleMessage(msg); },
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private async updateReport(report: CodeReviewReport): Promise<void> {
    this.currentReport = report;
    this.updateHtml();
    await this.persistReport(report);
  }

  private loadHistory(): CodeReviewReport[] {
    try {
      return this.workspaceState.get<CodeReviewReport[]>(ReviewPanel.HISTORY_KEY) ?? [];
    } catch {
      return [];
    }
  }

  private updateHtml(): void {
    if (!this.currentReport) return;
    const history = this.loadHistory();
    this.panel.webview.html = getReviewHtml(this.panel.webview, this.currentReport, history);
  }

  private async persistReport(report: CodeReviewReport): Promise<void> {
    await this.workspaceState.update('nexus.review.latestReportId', report.id);
    await this.workspaceState.update('nexus.review.latestReport', report);

    const history = this.loadHistory();
    // Deduplicate by id, keep newest at front
    const deduped = history.filter(r => r.id !== report.id);
    const updated = [report, ...deduped].slice(0, ReviewPanel.MAX_HISTORY);
    await this.workspaceState.update(ReviewPanel.HISTORY_KEY, updated);
  }

  private async _handleMessage(msg: unknown): Promise<void> {
    if (typeof msg !== 'object' || msg === null) return;
    const type = (msg as Record<string, unknown>)['type'];

    if (type === 'openFile') {
      const { path, line } = msg as { path: string; line?: number };
      await this.openFile(path, line);
      return;
    }

    if (type === 'exportReport') {
      await this.exportReport();
      return;
    }

    if (type === 'refresh') {
      this.updateHtml();
      return;
    }

    if (type === 'selectHistoryReport') {
      const { reportId } = msg as { reportId: string };
      const history = this.loadHistory();
      const found = history.find(r => r.id === reportId);
      if (found) await this.updateReport(found);
      return;
    }

    if (type === 'clearReviewHistory') {
      await this.workspaceState.update(ReviewPanel.HISTORY_KEY, []);
      this.updateHtml();
      return;
    }
  }

  private async openFile(filePath: string, line?: number): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }

      const fullPath = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
      const document = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);

      if (line && line > 0) {
        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to open file: ${message}`);
    }
  }

  private async exportReport(): Promise<void> {
    if (!this.currentReport) return;

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }

      const timestamp = new Date(this.currentReport.generatedAt).toISOString().replace(/[:.]/g, '-');
      const defaultUri = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        `.nexus/reviews/review-${timestamp}.md`,
      );

      const uri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          'Markdown': ['md'],
          'JSON': ['json'],
          'All Files': ['*'],
        },
      });

      if (!uri) return;

      const content = uri.fsPath.endsWith('.json')
        ? JSON.stringify(this.currentReport, null, 2)
        : this.formatAsMarkdown(this.currentReport);

      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
      vscode.window.showInformationMessage(`Report exported to ${uri.fsPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to export report: ${message}`);
    }
  }

  private formatAsMarkdown(report: CodeReviewReport): string {
    const lines: string[] = [];
    lines.push(`# Code Review Report`);
    lines.push('');
    lines.push(`**Generated:** ${new Date(report.generatedAt).toISOString()}`);
    lines.push(`**Target:** ${report.target.type} (${report.baseBranch || 'main'})`);
    lines.push('');
    lines.push(`## Verdict: ${report.verdict}`);
    if (report.architectureVerdict) {
      lines.push(`**Architecture:** ${report.architectureVerdict}`);
    }
    lines.push('');
    lines.push(`## Summary`);
    lines.push(report.summary);
    lines.push('');

    if (report.architectureSummary) {
      lines.push(`### Architecture Summary`);
      lines.push(report.architectureSummary);
      lines.push('');
    }

    if (report.architectureScore) {
      lines.push(`### Architecture Score`);
      lines.push(`- Overall: ${report.architectureScore.overall}/100`);
      lines.push(`- Coupling: ${report.architectureScore.coupling}/100`);
      lines.push(`- Cohesion: ${report.architectureScore.cohesion}/100`);
      lines.push(`- Abstraction: ${report.architectureScore.abstraction}/100`);
      lines.push('');
    }

    lines.push(`## Statistics`);
    lines.push(`- Total Findings: ${report.stats.totalFindings}`);
    lines.push(`- Blocker: ${report.stats.blocker}`);
    lines.push(`- Critical: ${report.stats.critical}`);
    lines.push(`- Major: ${report.stats.major}`);
    lines.push(`- Minor: ${report.stats.minor}`);
    lines.push('');

    lines.push(`## Findings`);
    lines.push('');

    for (const finding of report.findings) {
      lines.push(`### ${finding.title}`);
      lines.push(`**Severity:** ${finding.severity} | **Category:** ${finding.category}`);
      if (finding.filePath) {
        lines.push(`**File:** ${finding.filePath}${finding.lineStart ? `:${finding.lineStart}` : ''}`);
      }
      lines.push('');
      lines.push(finding.description);
      if (finding.evidence) {
        lines.push('');
        lines.push('**Evidence:**');
        lines.push('```');
        lines.push(finding.evidence);
        lines.push('```');
      }
      if (finding.recommendation) {
        lines.push('');
        lines.push('**Recommendation:**');
        lines.push(finding.recommendation);
      }
      lines.push('');
    }

    lines.push(`## Changed Files (${report.changedFiles.length})`);
    lines.push('');
    for (const file of report.changedFiles) {
      const stats = file.additions || file.deletions
        ? ` (+${file.additions || 0}/-${file.deletions || 0})`
        : '';
      lines.push(`- [${file.status}] ${file.path}${stats}`);
    }

    // Report summary table
    if (report.findings.length > 0) {
      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('## Report Summary');
      lines.push('');
      lines.push('| # | Severity | Category | File | Issue |');
      lines.push('|---|----------|----------|------|-------|');

      const severityOrder: Record<string, number> = {
        blocker: 0, critical: 1, major: 2, minor: 3, nit: 4, info: 5,
      };
      const sorted = [...report.findings].sort(
        (a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5),
      );

      for (const [i, f] of sorted.entries()) {
        const file = f.filePath
          ? `${f.filePath}${f.lineStart ? `:${f.lineStart}` : ''}`
          : '—';
        lines.push(`| ${i + 1} | **${f.severity.toUpperCase()}** | ${f.category} | \`${file}\` | ${f.title} |`);
      }
    }

    return lines.join('\n');
  }

  dispose(): void {
    ReviewPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) { d.dispose(); }
    this.disposables.length = 0;
  }
}
