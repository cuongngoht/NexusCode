import * as vscode from 'vscode';
import type { AnalyticsRunRecord, AnalyticsQuery, AnalyticsFeedback } from './AnalyticsTypes';

const ANALYTICS_DIR = 'analytics';
const RUNS_FILE = 'runs.jsonl';

function matchesQuery(record: AnalyticsRunRecord, query: AnalyticsQuery): boolean {
  if (query.from != null && record.startedAt < query.from) return false;
  if (query.to != null && record.startedAt > query.to) return false;
  if (query.provider != null && record.provider !== query.provider) return false;
  if (query.model != null && record.model !== query.model) return false;
  if (query.mode != null && record.mode !== query.mode) return false;
  if (query.conversationId != null && record.conversationId !== query.conversationId) return false;
  if (query.workspaceId != null && record.workspaceId !== query.workspaceId) return false;
  if (query.status != null && record.status !== query.status) return false;
  return true;
}

export class AnalyticsStore {
  constructor(private readonly globalStorageUri: vscode.Uri) {}

  private get runsUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.globalStorageUri, ANALYTICS_DIR, RUNS_FILE);
  }

  private get analyticsDirUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.globalStorageUri, ANALYTICS_DIR);
  }

  private async ensureDir(): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(this.analyticsDirUri);
    } catch {
      // Directory may already exist; ignore
    }
  }

  private async readAllLines(): Promise<string[]> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.runsUri);
      return new TextDecoder().decode(bytes).split('\n').filter(l => l.trim().length > 0);
    } catch {
      // File doesn't exist yet
      return [];
    }
  }

  async appendRun(record: AnalyticsRunRecord): Promise<void> {
    await this.ensureDir();
    const line = JSON.stringify(record) + '\n';
    try {
      // Read existing content and append
      let existing = '';
      try {
        const bytes = await vscode.workspace.fs.readFile(this.runsUri);
        existing = new TextDecoder().decode(bytes);
      } catch {
        // File doesn't exist
      }
      const newContent = existing + line;
      await vscode.workspace.fs.writeFile(this.runsUri, new TextEncoder().encode(newContent));
    } catch {
      // If write fails silently, don't crash the extension
    }
  }

  async listRuns(query?: AnalyticsQuery): Promise<AnalyticsRunRecord[]> {
    const lines = await this.readAllLines();
    const records: AnalyticsRunRecord[] = [];
    for (const line of lines) {
      try {
        const record = JSON.parse(line) as AnalyticsRunRecord;
        if (!query || matchesQuery(record, query)) {
          records.push(record);
        }
      } catch {
        // Corrupt JSONL line — skip
      }
    }
    return records;
  }

  async updateFeedback(taskId: string, feedback: AnalyticsFeedback, reason?: string): Promise<void> {
    await this.ensureDir();
    const lines = await this.readAllLines();
    let changed = false;
    const updatedLines = lines.map(line => {
      try {
        const record = JSON.parse(line) as AnalyticsRunRecord;
        if (record.taskId === taskId) {
          record.feedback = feedback;
          if (reason !== undefined) record.feedbackReason = reason;
          changed = true;
          return JSON.stringify(record);
        }
      } catch {
        // Corrupt line — keep as-is
      }
      return line;
    });

    if (changed) {
      const newContent = updatedLines.join('\n') + '\n';
      await vscode.workspace.fs.writeFile(this.runsUri, new TextEncoder().encode(newContent));
    }
  }

  async clearAll(): Promise<void> {
    try {
      await vscode.workspace.fs.writeFile(this.runsUri, new TextEncoder().encode(''));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async exportJson(query?: AnalyticsQuery): Promise<string> {
    const records = await this.listRuns(query);
    return JSON.stringify(records, null, 2);
  }

  async exportCsv(query?: AnalyticsQuery): Promise<string> {
    const records = await this.listRuns(query);
    const header = 'startedAt,provider,model,mode,status,totalTokens,inputTokens,outputTokens,estimatedTotalCostUsd,latencyMs,filesChanged,linesAdded,linesDeleted,testsGenerated,bugsFixed,feedback';
    const rows = records.map(r =>
      [
        r.startedAt,
        r.provider,
        r.model ?? '',
        r.mode,
        r.status,
        r.totalTokens,
        r.inputTokens,
        r.outputTokens,
        r.estimatedTotalCostUsd,
        r.latencyMs ?? '',
        r.filesChanged,
        r.linesAdded,
        r.linesDeleted,
        r.testsGenerated,
        r.bugsFixed,
        r.feedback,
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  async pruneOlderThan(days: number): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const lines = await this.readAllLines();
    let removedCount = 0;
    const kept: string[] = [];
    for (const line of lines) {
      try {
        const record = JSON.parse(line) as AnalyticsRunRecord;
        if (record.startedAt < cutoff) {
          removedCount += 1;
        } else {
          kept.push(line);
        }
      } catch {
        // Keep corrupt lines rather than losing them silently
        kept.push(line);
      }
    }
    if (removedCount > 0) {
      await this.ensureDir();
      const newContent = kept.join('\n') + (kept.length > 0 ? '\n' : '');
      await vscode.workspace.fs.writeFile(this.runsUri, new TextEncoder().encode(newContent));
    }
    return removedCount;
  }
}
