import { execFileSync } from 'child_process';
import type { GitReviewContext, GitReviewFileChange } from '../core/types';
import { detectDefaultBaseBranch, getCurrentBranch, getLocalBranches } from './gitBranch';

const DEFAULT_DIFF_CHAR_LIMIT = 60_000;

const DIFF_MAX_BUFFER = 100 * 1024 * 1024; // 100 MB — large repos can produce big diffs
const META_MAX_BUFFER = 4 * 1024 * 1024;   // 4 MB — sufficient for name-status, stat, branch list

function git(workspaceRoot: string, args: string[], maxBuffer = META_MAX_BUFFER): string {
  return execFileSync('git', args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer,
  }).trim();
}

function parseNameStatus(output: string): GitReviewFileChange[] {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [status, ...rest] = line.split(/\s+/);
      return { status, path: rest.join(' ') };
    });
}

export function buildGitReviewContext(
  workspaceRoot: string,
  baseBranch?: string,
  diffCharLimit: number = DEFAULT_DIFF_CHAR_LIMIT,
): GitReviewContext {
  const currentBranch = getCurrentBranch(workspaceRoot);
  const availableBranches = getLocalBranches(workspaceRoot);
  const resolvedBase = baseBranch || detectDefaultBaseBranch(workspaceRoot);

  if (!resolvedBase) {
    return {
      baseBranch: '',
      compareBranch: currentBranch,
      currentBranch,
      availableBranches,
      changedFiles: [],
      diffStat: '',
      diff: '',
      diffTruncated: false,
      message: 'Cannot detect a base branch. Please select a base branch.',
    };
  }

  const range = `${resolvedBase}...HEAD`;

  const nameStatus = git(workspaceRoot, ['diff', '--name-status', range]);
  const diffStat = git(workspaceRoot, ['diff', '--stat', range]);
  let diff = git(workspaceRoot, ['diff', '-U5', '--find-renames', range], DIFF_MAX_BUFFER);

  let diffTruncated = false;
  if (diff.length > diffCharLimit) {
    diff = diff.slice(0, diffCharLimit);
    diffTruncated = true;
  }

  return {
    baseBranch: resolvedBase,
    compareBranch: currentBranch,
    currentBranch,
    availableBranches,
    changedFiles: parseNameStatus(nameStatus),
    diffStat,
    diff,
    diffTruncated,
  };
}
