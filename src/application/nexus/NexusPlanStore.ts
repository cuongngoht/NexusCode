import * as fs from 'fs';
import * as path from 'path';

export class NexusPlanStore {
  static save(workspaceRoot: string, runId: string, content: string): string {
    const nexusDir = path.join(workspaceRoot, '.nexus');
    const runDir = path.join(nexusDir, 'runs', runId);
    fs.mkdirSync(runDir, { recursive: true });
    const runPlanPath = path.join(runDir, 'plan.md');
    fs.writeFileSync(runPlanPath, content, 'utf8');
    fs.writeFileSync(path.join(nexusDir, 'plan.md'), content, 'utf8');
    return runPlanPath;
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
