import { spawnSync } from 'child_process';
import { GitFileChange } from '../core/types';

export interface GitStatusResult {
  available: boolean;
  changes: GitFileChange[];
  message?: string;
}

export function getGitStatus(cwd: string): GitStatusResult {
  try {
    const result = spawnSync('git', ['status', '--porcelain'], {
      cwd,
      encoding: 'utf8',
      timeout: 5000,
      shell: false,
    });

    if (result.error) {
      return { available: false, changes: [], message: 'git is not available on PATH.' };
    }

    if (result.status !== 0) {
      const stderr = (result.stderr ?? '').toString().toLowerCase();
      if (stderr.includes('not a git repository')) {
        return { available: false, changes: [], message: 'This workspace is not a git repository.' };
      }
      return { available: false, changes: [], message: 'git status failed.' };
    }

    const output = (result.stdout ?? '').toString();
    const changes = parsePortcelainOutput(output);
    return { available: true, changes };
  } catch {
    return { available: false, changes: [], message: 'git is not available.' };
  }
}

function parsePortcelainOutput(output: string): GitFileChange[] {
  const changes: GitFileChange[] = [];
  for (const line of output.split('\n')) {
    if (line.length < 3) {
      continue;
    }
    const status = line.substring(0, 2).trim();
    const filePath = line.substring(3);
    if (filePath) {
      changes.push({ status, path: filePath });
    }
  }
  return changes;
}
