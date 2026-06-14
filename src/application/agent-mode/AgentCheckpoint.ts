import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import type { AgentSession } from './AgentSession';

export interface AgentCheckpointRecord {
  id: string;
  sessionId: string;
  type: 'git' | 'snapshot';
  workspaceRoot: string;
  gitHead?: string;
  gitStatusBefore?: string;
  gitDiffBeforePath?: string;
  snapshotDir?: string;
  filesSnapshotted: string[];
  createdAt: number;
}

function runGit(args: string[], cwd: string): { stdout: string; ok: boolean } {
  const result = spawnSync('git', args, {
    cwd,
    shell: false,
    timeout: 15000,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  return { stdout: result.stdout ?? '', ok: result.status === 0 };
}

function isGitRepo(workspaceRoot: string): boolean {
  return runGit(['rev-parse', '--is-inside-work-tree'], workspaceRoot).ok;
}

function safePath(workspaceRoot: string, filePath: string): string | null {
  const resolved = path.resolve(workspaceRoot, filePath);
  if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
    return null; // Outside workspace root — skip
  }
  return resolved;
}

export class AgentCheckpoint {
  async create(session: AgentSession): Promise<AgentCheckpointRecord> {
    const { workspaceRoot } = session;
    const now = Date.now();
    const id = `chk_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const checkpointDir = path.join(workspaceRoot, '.nexus', 'checkpoints', session.id, id);

    if (isGitRepo(workspaceRoot)) {
      return this.createGitCheckpoint(session, id, checkpointDir, now);
    } else {
      return this.createSnapshotCheckpoint(session, id, checkpointDir, now);
    }
  }

  private createGitCheckpoint(
    session: AgentSession,
    id: string,
    checkpointDir: string,
    now: number,
  ): AgentCheckpointRecord {
    const { workspaceRoot } = session;
    fs.mkdirSync(checkpointDir, { recursive: true });

    const { stdout: gitHead, ok: headOk } = runGit(['rev-parse', 'HEAD'], workspaceRoot);
    if (!headOk) {
      throw new Error('Git checkpoint failed: could not determine HEAD commit.');
    }

    const { stdout: gitStatus } = runGit(['status', '--porcelain'], workspaceRoot);
    const { stdout: gitDiff } = runGit(['diff', 'HEAD'], workspaceRoot);

    const patchPath = path.join(checkpointDir, 'before.patch');
    fs.writeFileSync(patchPath, gitDiff, 'utf8');

    const record: AgentCheckpointRecord = {
      id,
      sessionId: session.id,
      type: 'git',
      workspaceRoot,
      gitHead: gitHead.trim(),
      gitStatusBefore: gitStatus,
      gitDiffBeforePath: patchPath,
      filesSnapshotted: [],
      createdAt: now,
    };

    const recordPath = path.join(checkpointDir, 'checkpoint.json');
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf8');

    return record;
  }

  private createSnapshotCheckpoint(
    session: AgentSession,
    id: string,
    checkpointDir: string,
    now: number,
  ): AgentCheckpointRecord {
    const { workspaceRoot } = session;
    const snapshotDir = path.join(checkpointDir, 'files');
    fs.mkdirSync(snapshotDir, { recursive: true });

    const plannedFiles = session.plan
      ? [...(session.plan.filesToEdit ?? []), ...(session.plan.filesToDelete ?? [])]
      : [];

    const filesSnapshotted: string[] = [];
    const errors: string[] = [];

    for (const relPath of plannedFiles) {
      const absPath = safePath(workspaceRoot, relPath);
      if (!absPath) continue;
      if (!fs.existsSync(absPath)) continue;

      try {
        const destPath = path.join(snapshotDir, relPath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(absPath, destPath);
        filesSnapshotted.push(relPath);
      } catch (err) {
        errors.push(`Failed to snapshot ${relPath}: ${String(err)}`);
      }
    }

    if (filesSnapshotted.length === 0 && plannedFiles.length > 0) {
      throw new Error(`Snapshot checkpoint failed: no files could be snapshotted. Errors: ${errors.join('; ')}`);
    }

    const record: AgentCheckpointRecord = {
      id,
      sessionId: session.id,
      type: 'snapshot',
      workspaceRoot,
      snapshotDir,
      filesSnapshotted,
      createdAt: now,
    };

    const recordPath = path.join(checkpointDir, 'checkpoint.json');
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf8');

    return record;
  }
}
