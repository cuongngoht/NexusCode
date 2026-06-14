import * as path from 'path';
import { spawnSync } from 'child_process';
import type { AgentSession } from './AgentSession';
import type { AgentModePolicy } from './AgentModePolicy';

export type DiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';

export interface AgentChangedFile {
  path: string;
  status: DiffFileStatus;
  additions?: number;
  deletions?: number;
}

export interface AgentDiffSummary {
  sessionId: string;
  changedFiles: AgentChangedFile[];
  addedLines: number;
  deletedLines: number;
  diffStat: string;
  diff: string;
  diffTruncated: boolean;
}

const BINARY_EXTENSIONS = new Set([
  '.vsix', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib',
]);

const IGNORED_PATHS = ['__MACOSX', '.DS_Store', 'media/webview'];

function shouldIgnorePath(filePath: string): boolean {
  return IGNORED_PATHS.some(ignored => filePath.includes(ignored))
    || BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isGitRepo(workspaceRoot: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: workspaceRoot,
    shell: false,
    timeout: 5000,
  });
  return result.status === 0;
}

function runGit(args: string[], cwd: string): string {
  const result = spawnSync('git', args, {
    cwd,
    shell: false,
    timeout: 15000,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) return '';
  return result.stdout ?? '';
}

function parseStatusLine(line: string): AgentChangedFile | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const code = trimmed[0];
  const filePath = trimmed.slice(1).trim().replace(/"/g, '');
  if (shouldIgnorePath(filePath)) return null;

  let status: DiffFileStatus = 'unknown';
  if (code === 'M') status = 'modified';
  else if (code === 'A') status = 'added';
  else if (code === 'D') status = 'deleted';
  else if (code === 'R') status = 'renamed';

  return { path: filePath, status };
}

export class AgentDiffCollector {
  async collect(session: AgentSession, policy: AgentModePolicy): Promise<AgentDiffSummary> {
    const workspaceRoot = session.workspaceRoot;

    if (isGitRepo(workspaceRoot)) {
      return this.collectGitDiff(session, policy);
    }

    return this.collectSnapshotDiff(session, policy);
  }

  private collectGitDiff(session: AgentSession, policy: AgentModePolicy): AgentDiffSummary {
    const { workspaceRoot } = session;

    const statusOutput = runGit(['status', '--porcelain'], workspaceRoot);
    const changedFiles: AgentChangedFile[] = statusOutput
      .split('\n')
      .map(parseStatusLine)
      .filter((f): f is AgentChangedFile => f !== null);

    const diffStatOutput = runGit(['diff', '--stat', 'HEAD'], workspaceRoot);
    const diffOutput = runGit(['diff', 'HEAD'], workspaceRoot);

    let addedLines = 0;
    let deletedLines = 0;

    // Parse line counts from diff --stat
    const statMatch = diffStatOutput.match(/(\d+) insertions?.*?(\d+) deletions?/);
    if (statMatch) {
      addedLines = parseInt(statMatch[1], 10);
      deletedLines = parseInt(statMatch[2], 10);
    }

    const maxDiff = policy.maxDiffChars;
    let diff = diffOutput;
    let diffTruncated = false;

    if (diff.length > maxDiff) {
      diff = diff.slice(0, maxDiff);
      diffTruncated = true;
    }

    return {
      sessionId: session.id,
      changedFiles,
      addedLines,
      deletedLines,
      diffStat: diffStatOutput.trim(),
      diff,
      diffTruncated,
    };
  }

  private collectSnapshotDiff(session: AgentSession, _policy: AgentModePolicy): AgentDiffSummary {
    const touchedPaths = session.plan
      ? [
          ...session.plan.filesToEdit,
          ...session.plan.filesToCreate,
          ...session.plan.filesToDelete,
        ]
      : [];

    const changedFiles: AgentChangedFile[] = touchedPaths
      .filter(p => !shouldIgnorePath(p))
      .map(p => ({
        path: p,
        status: session.plan?.filesToCreate.includes(p)
          ? 'added'
          : session.plan?.filesToDelete.includes(p)
          ? 'deleted'
          : 'modified',
      }));

    return {
      sessionId: session.id,
      changedFiles,
      addedLines: 0,
      deletedLines: 0,
      diffStat: `${changedFiles.length} file(s) changed (no git repo)`,
      diff: '',
      diffTruncated: false,
    };
  }
}
