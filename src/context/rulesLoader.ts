import * as fs from 'fs';
import * as path from 'path';

export function loadRules(workspaceRoot: string): string {
  const rulesPath = path.join(workspaceRoot, '.nexus', 'rules.md');
  try {
    return fs.readFileSync(rulesPath, 'utf8').trim();
  } catch {
    return '';
  }
}
