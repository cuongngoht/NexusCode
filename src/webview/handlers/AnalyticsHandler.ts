import * as vscode from 'vscode';
import * as path from 'path';
import type { ExtensionMessage } from '../webviewProtocol';
import type { AnalyticsService } from '../../analytics/AnalyticsService';
import type { AnalyticsQuery, AnalyticsFeedback } from '../../analytics/AnalyticsTypes';

export class AnalyticsHandler {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly postMessage: (msg: ExtensionMessage) => void,
    private readonly globalStorageUri: vscode.Uri,
  ) {}

  async getSummary(query?: AnalyticsQuery): Promise<void> {
    try {
      const summary = await this.analyticsService.getSummary(query);
      this.postMessage({ type: 'analyticsSummary', summary });
    } catch (err) {
      this.postMessage({ type: 'analyticsError', message: String(err) });
    }
  }

  async getRuns(query?: AnalyticsQuery): Promise<void> {
    try {
      const runs = await this.analyticsService.getRuns(query);
      this.postMessage({ type: 'analyticsRuns', runs });
    } catch (err) {
      this.postMessage({ type: 'analyticsError', message: String(err) });
    }
  }

  async submitFeedback(taskId: string, feedback: AnalyticsFeedback, reason?: string): Promise<void> {
    try {
      await this.analyticsService.updateFeedback(taskId, feedback, reason);
      // Re-send updated summary after feedback
      const summary = await this.analyticsService.getSummary();
      this.postMessage({ type: 'analyticsSummary', summary });
    } catch (err) {
      this.postMessage({ type: 'analyticsError', message: String(err) });
    }
  }

  async export(format: 'json' | 'csv' | 'markdown', query?: AnalyticsQuery): Promise<void> {
    try {
      const content = await this.analyticsService.export(format, query);
      const ext = format === 'markdown' ? 'md' : format;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `nexus-analytics-${timestamp}.${ext}`;
      const exportUri = vscode.Uri.joinPath(this.globalStorageUri, 'analytics', 'exports', fileName);

      // Ensure export directory exists
      try {
        await vscode.workspace.fs.createDirectory(
          vscode.Uri.joinPath(this.globalStorageUri, 'analytics', 'exports'),
        );
      } catch {
        // Directory may already exist
      }

      await vscode.workspace.fs.writeFile(exportUri, new TextEncoder().encode(content));
      const exportPath = exportUri.fsPath;
      this.postMessage({ type: 'analyticsExported', path: exportPath });

      // Also offer to open the file
      const openAction = 'Open File';
      const revealAction = 'Reveal in Explorer';
      void vscode.window.showInformationMessage(
        `Analytics exported: ${path.basename(exportPath)}`,
        openAction,
        revealAction,
      ).then(action => {
        if (action === openAction) {
          void vscode.window.showTextDocument(exportUri);
        } else if (action === revealAction) {
          void vscode.commands.executeCommand('revealFileInOS', exportUri);
        }
      });
    } catch (err) {
      this.postMessage({ type: 'analyticsError', message: String(err) });
    }
  }

  async clear(): Promise<void> {
    try {
      await this.analyticsService.clearAll();
      // Send empty summary after clear
      const summary = await this.analyticsService.getSummary();
      this.postMessage({ type: 'analyticsSummary', summary });
    } catch (err) {
      this.postMessage({ type: 'analyticsError', message: String(err) });
    }
  }
}
