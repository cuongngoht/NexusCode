import { spawnSync } from 'child_process';
import type { AgentSession } from './AgentSession';
import type { AgentModePolicy } from './AgentModePolicy';

function runGit(args: string[], cwd: string): { stdout: string; stderr: string; ok: boolean } {
  const result = spawnSync('git', args, {
    cwd,
    shell: false,
    timeout: 10000,
    encoding: 'utf8',
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ok: result.status === 0,
  };
}

function isGitRepo(workspaceRoot: string): boolean {
  return runGit(['rev-parse', '--is-inside-work-tree'], workspaceRoot).ok;
}

export class AgentBranchManager {
  /**
   * If policy.useWorkingBranch is true, creates a new branch for the session
   * and returns the working branch name.
   * Returns undefined if branch creation is not required or fails.
   */
  async createWorkingBranch(
    session: AgentSession,
    policy: AgentModePolicy,
  ): Promise<string | undefined> {
    if (!policy.useWorkingBranch) return undefined;
    const { workspaceRoot } = session;

    if (!isGitRepo(workspaceRoot)) {
      // Not a git repo — skip branch creation
      return undefined;
    }

    // Get current branch
    const { ok: branchOk } = runGit(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      workspaceRoot,
    );
    if (!branchOk) {
      throw new Error('Agent branch manager: could not determine current branch.');
    }

    const branchName = `${policy.branchPrefix}${session.id}`;

    const { ok, stderr } = runGit(['switch', '-c', branchName], workspaceRoot);
    if (!ok) {
      // Try legacy checkout -b
      const { ok: ok2, stderr: stderr2 } = runGit(['checkout', '-b', branchName], workspaceRoot);
      if (!ok2) {
        throw new Error(
          `Agent branch manager: could not create branch '${branchName}'. ` +
          `Error: ${stderr2 || stderr}`,
        );
      }
    }

    return branchName;
  }

  /**
   * Returns the current branch name.
   */
  getCurrentBranch(workspaceRoot: string): string | undefined {
    if (!isGitRepo(workspaceRoot)) return undefined;
    const { stdout, ok } = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], workspaceRoot);
    return ok ? stdout.trim() : undefined;
  }
}
