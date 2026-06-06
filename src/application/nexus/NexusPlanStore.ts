import * as fs from 'fs';
import * as path from 'path';

export class NexusPlanStore {
  static save(workspaceRoot: string, runId: string, content: string): void {
    const nexusDir = path.join(workspaceRoot, '.nexus');
    const runDir = path.join(nexusDir, 'runs', runId);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'plan.md'), content, 'utf8');
    fs.writeFileSync(path.join(nexusDir, 'plan.md'), content, 'utf8');
  }

  static load(workspaceRoot: string, planPath?: string): string | null {
    const target = planPath ?? path.join(workspaceRoot, '.nexus', 'plan.md');
    try {
      return fs.readFileSync(target, 'utf8');
    } catch {
      return null;
    }
  }
}
