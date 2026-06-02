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
