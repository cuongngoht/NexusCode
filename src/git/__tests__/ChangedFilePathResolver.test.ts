import { describe, it, expect } from 'vitest';
import { resolveRenamePath, diffGitSnapshots } from '../ChangedFilePathResolver';
import type { GitFileChange } from '../../core/types';

describe('resolveRenamePath', () => {
  it('splits a rename status line into oldPath/path', () => {
    const change: GitFileChange = { status: 'R100', path: 'old.ts -> new.ts' };
    expect(resolveRenamePath(change)).toEqual({ path: 'new.ts', oldPath: 'old.ts', status: 'R100' });
  });

  it('leaves non-rename statuses unchanged', () => {
    const change: GitFileChange = { status: 'M', path: 'src/foo.ts' };
    expect(resolveRenamePath(change)).toEqual({ path: 'src/foo.ts', status: 'M' });
  });

  it('does not treat an R-status without an arrow as a rename', () => {
    const change: GitFileChange = { status: 'R', path: 'src/foo.ts' };
    expect(resolveRenamePath(change)).toEqual({ path: 'src/foo.ts', status: 'R' });
  });
});

describe('diffGitSnapshots', () => {
  it('includes a path new since the pre-task snapshot', () => {
    const pre: GitFileChange[] = [];
    const post: GitFileChange[] = [{ status: '??', path: 'src/new.ts' }];
    const { taskDeltaPaths, workspaceChangedPaths } = diffGitSnapshots(pre, post);
    expect(taskDeltaPaths).toEqual([{ path: 'src/new.ts', status: '??' }]);
    expect(workspaceChangedPaths).toEqual([{ path: 'src/new.ts', status: '??' }]);
  });

  it('includes a path whose status transitioned during the run', () => {
    const pre: GitFileChange[] = [{ status: '??', path: 'src/foo.ts' }];
    const post: GitFileChange[] = [{ status: 'A', path: 'src/foo.ts' }];
    const { taskDeltaPaths } = diffGitSnapshots(pre, post);
    expect(taskDeltaPaths).toEqual([{ path: 'src/foo.ts', status: 'A' }]);
  });

  it('excludes a path with an identical status in both snapshots (known false negative)', () => {
    const pre: GitFileChange[] = [{ status: 'M', path: 'src/foo.ts' }];
    const post: GitFileChange[] = [{ status: 'M', path: 'src/foo.ts' }];
    const { taskDeltaPaths } = diffGitSnapshots(pre, post);
    expect(taskDeltaPaths).toEqual([]);
  });

  it('excludes a path reverted during the run (present in pre, absent from post)', () => {
    const pre: GitFileChange[] = [{ status: '??', path: 'src/foo.ts' }];
    const post: GitFileChange[] = [];
    const { taskDeltaPaths, workspaceChangedPaths } = diffGitSnapshots(pre, post);
    expect(taskDeltaPaths).toEqual([]);
    expect(workspaceChangedPaths).toEqual([]);
  });

  it('splits a rename into an old-path removal signal and a new-path add, both in the delta', () => {
    const pre: GitFileChange[] = [];
    const post: GitFileChange[] = [{ status: 'R100', path: 'src/old.ts -> src/new.ts' }];
    const { taskDeltaPaths, workspaceChangedPaths } = diffGitSnapshots(pre, post);
    expect(taskDeltaPaths).toEqual(
      expect.arrayContaining([
        { path: 'src/new.ts', oldPath: 'src/old.ts', status: 'R100' },
        { path: 'src/old.ts', status: 'D' },
      ]),
    );
    expect(taskDeltaPaths).toHaveLength(2);
    expect(workspaceChangedPaths).toEqual([{ path: 'src/new.ts', oldPath: 'src/old.ts', status: 'R100' }]);
  });
});
