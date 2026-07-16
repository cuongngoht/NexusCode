import * as fs from 'fs';
import * as path from 'path';
import type { FindingFingerprint } from './ReviewFingerprint';

export class ReviewBaselineStore {
  private readonly baselinePath: string;

  constructor(workspaceRoot: string) {
    this.baselinePath = path.join(workspaceRoot, '.nexus', 'auto-reviews', 'baseline.json');
  }

  load(): FindingFingerprint[] {
    try {
      const raw = fs.readFileSync(this.baselinePath, 'utf-8');
      return JSON.parse(raw) as FindingFingerprint[];
    } catch {
      return [];
    }
  }

  save(fingerprints: FindingFingerprint[]): void {
    const dir = path.dirname(this.baselinePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.baselinePath, JSON.stringify(fingerprints, null, 2), 'utf-8');
  }

  has(fingerprint: string): boolean {
    return this.load().some(f => f.fingerprint === fingerprint);
  }
}
