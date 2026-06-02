import { spawnSync } from 'child_process';
import * as path from 'path';

export interface WorkspaceInfo {
  name: string;
  root: string;
  gitBranch: string;
}

export function scanWorkspace(workspaceRoot: string): WorkspaceInfo {
  const name = path.basename(workspaceRoot);
  const gitBranch = detectGitBranch(workspaceRoot);
  return { name, root: workspaceRoot, gitBranch };
}

function detectGitBranch(cwd: string): string {
  try {
    const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      timeout: 3000,
      shell: false,
    });
    if (result.status === 0 && result.stdout) {
      return result.stdout.trim();
    }
  } catch {
    // not a git repo or git unavailable
  }
  return '';
}
