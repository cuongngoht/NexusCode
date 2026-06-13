import { spawnSync } from 'child_process';

export function getGitDiff(cwd: string, filePath: string): string {
  try {
    const result = spawnSync('git', ['diff', 'HEAD', '--', filePath], {
      cwd,
      encoding: 'utf8',
      timeout: 5000,
      shell: false,
    });
    if (result.status === 0) {
      return (result.stdout ?? '').toString();
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * Get raw unified diff output.
 * If filePath is provided, diff is scoped to that file.
 * If baseRef is provided, diff is computed against that ref instead of HEAD.
 */
export function getRawDiff(cwd: string, filePath?: string, baseRef?: string): string {
  try {
    const ref = baseRef ?? 'HEAD';
    const args = ['diff', ref];
    if (filePath) {
      args.push('--', filePath);
    }
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: 10000,
      shell: false,
    });
    if (result.status === 0) {
      return (result.stdout ?? '').toString();
    }
  } catch {
    // ignore
  }
  return '';
}
