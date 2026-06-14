import type { CodeReviewReport } from './CodeReviewReport';

/**
 * In-memory store for the latest code review report per workspace session.
 * Not persisted to disk — reports are transient per session.
 */
export class CodeReviewStore {
  private _reports: Map<string, CodeReviewReport> = new Map();
  private _latest: CodeReviewReport | null = null;

  save(report: CodeReviewReport): void {
    this._reports.set(report.id, report);
    this._latest = report;
  }

  getById(id: string): CodeReviewReport | undefined {
    return this._reports.get(id);
  }

  getLatest(): CodeReviewReport | null {
    return this._latest;
  }

  list(): CodeReviewReport[] {
    return [...this._reports.values()].sort((a, b) => b.generatedAt - a.generatedAt);
  }

  clear(): void {
    this._reports.clear();
    this._latest = null;
  }
}
