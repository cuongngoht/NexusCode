import type { GitFileChange } from '../core/types';

export interface ResolvedChange {
  path: string;
  oldPath?: string;
  status: string;
}

export interface GitSnapshotDiff {
  /** Best-effort "this run touched these" — new/transitioned paths since the pre-task snapshot. */
  taskDeltaPaths: ResolvedChange[];
  /** Rename-resolved current dirty state — same semantics as today's changedFiles. */
  workspaceChangedPaths: ResolvedChange[];
}

const RENAME_ARROW = ' -> ';

/**
 * `git status --porcelain` reports a rename as a single line whose path field is
 * literally "old.ts -> new.ts". Splitting it out is required before any path-based
 * comparison (merging, deletion detection) can treat old/new as distinct identities.
 */
export function resolveRenamePath(change: GitFileChange): ResolvedChange {
  if (change.status.startsWith('R') && change.path.includes(RENAME_ARROW)) {
    const [oldPath, newPath] = change.path.split(RENAME_ARROW);
    return { path: newPath, oldPath, status: change.status };
  }
  return { path: change.path, status: change.status };
}

/**
 * Computes what changed between a pre-task and post-task git status snapshot.
 *
 * taskDeltaPaths is deliberately conservative: a path present in both snapshots with an
 * identical status code is excluded (a file dirty before the run, edited again identically
 * during the run, won't be captured here — it self-heals on the next task's refresh or the
 * next full scan, nothing is permanently lost).
 */
export function diffGitSnapshots(pre: GitFileChange[], post: GitFileChange[]): GitSnapshotDiff {
  const workspaceChangedPaths = post.map(resolveRenamePath);
  const preStatusByPath = new Map(pre.map(resolveRenamePath).map(c => [c.path, c.status]));

  const taskDeltaPaths: ResolvedChange[] = [];
  for (const change of workspaceChangedPaths) {
    if (change.oldPath !== undefined) {
      // A rename is inherently a state transition for both identities involved.
      taskDeltaPaths.push(change);
      taskDeltaPaths.push({ path: change.oldPath, status: 'D' });
      continue;
    }
    const preStatus = preStatusByPath.get(change.path);
    if (preStatus === undefined || preStatus !== change.status) {
      taskDeltaPaths.push(change);
    }
  }

  return { taskDeltaPaths, workspaceChangedPaths };
}
