import * as fs from 'fs';
import * as path from 'path';

export function loadPlanContent(workspaceRoot: string): string {
  try {
    return fs.readFileSync(path.join(workspaceRoot, '.nexus', 'plan.md'), 'utf8').trim();
  } catch {
    return '';
  }
}
