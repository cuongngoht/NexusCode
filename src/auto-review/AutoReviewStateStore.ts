import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { AutoReviewReport, AutoReviewIndexEntry } from './AutoReviewReport';
import type { AutoReviewConfig } from './AutoReviewConfig';

export class AutoReviewStateStore {
  private readonly storageRoot: string;

  constructor(workspaceRoot: string) {
    this.storageRoot = path.join(workspaceRoot, '.nexus', 'auto-reviews');
  }

  ensureDirs(): void {
    for (const sub of ['reports', 'patches', 'logs']) {
      fs.mkdirSync(path.join(this.storageRoot, sub), { recursive: true });
    }
  }

  generateId(): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const rand = crypto.randomBytes(3).toString('hex');
    return `${ts}-${rand}`;
  }

  saveReport(report: AutoReviewReport): void {
    this.ensureDirs();
    fs.writeFileSync(
      path.join(this.storageRoot, 'reports', `${report.id}.json`),
      JSON.stringify(report, null, 2),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(this.storageRoot, 'latest.json'),
      JSON.stringify(report, null, 2),
      'utf-8',
    );
    const entry: AutoReviewIndexEntry = {
      id: report.id,
      timestamp: report.timestamp,
      verdict: report.codeReview?.verdict,
      risk: { level: report.risk.level, score: report.risk.score },
      skipped: report.skipped,
    };
    const index = this.loadIndex();
    index.unshift(entry);
    fs.writeFileSync(
      path.join(this.storageRoot, 'index.json'),
      JSON.stringify(index, null, 2),
      'utf-8',
    );
  }

  loadLatest(): AutoReviewReport | null {
    try {
      const raw = fs.readFileSync(path.join(this.storageRoot, 'latest.json'), 'utf-8');
      return JSON.parse(raw) as AutoReviewReport;
    } catch {
      return null;
    }
  }

  loadIndex(): AutoReviewIndexEntry[] {
    try {
      const raw = fs.readFileSync(path.join(this.storageRoot, 'index.json'), 'utf-8');
      return JSON.parse(raw) as AutoReviewIndexEntry[];
    } catch {
      return [];
    }
  }

  loadReport(id: string): AutoReviewReport | null {
    try {
      const raw = fs.readFileSync(path.join(this.storageRoot, 'reports', `${id}.json`), 'utf-8');
      return JSON.parse(raw) as AutoReviewReport;
    } catch {
      return null;
    }
  }

  pruneOldReports(config: AutoReviewConfig): void {
    if (!config.retention.enabled) return;
    const reportsDir = path.join(this.storageRoot, 'reports');
    if (!fs.existsSync(reportsDir)) return;

    const now = Date.now();
    const maxAgeMs = config.retention.maxAgeDays * 24 * 60 * 60 * 1000;

    let index = this.loadIndex();

    // Remove by age
    const toDelete = index.filter(e => now - e.timestamp > maxAgeMs);
    for (const entry of toDelete) {
      try { fs.unlinkSync(path.join(reportsDir, `${entry.id}.json`)); } catch { /* ok */ }
    }
    index = index.filter(e => now - e.timestamp <= maxAgeMs);

    // Trim by count
    if (index.length > config.retention.maxReports) {
      const excess = index.splice(config.retention.maxReports);
      for (const entry of excess) {
        try { fs.unlinkSync(path.join(reportsDir, `${entry.id}.json`)); } catch { /* ok */ }
      }
    }

    fs.writeFileSync(path.join(this.storageRoot, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  }

  clearAll(): void {
    const reportsDir = path.join(this.storageRoot, 'reports');
    if (fs.existsSync(reportsDir)) {
      for (const file of fs.readdirSync(reportsDir)) {
        try { fs.unlinkSync(path.join(reportsDir, file)); } catch { /* ok */ }
      }
    }
    for (const file of ['latest.json', 'index.json']) {
      try { fs.unlinkSync(path.join(this.storageRoot, file)); } catch { /* ok */ }
    }
  }
}
