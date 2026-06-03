import { execFileSync } from 'child_process';

function git(workspaceRoot: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 4 * 1024 * 1024, // 4 MB
  }).trim();
}

export function getCurrentBranch(workspaceRoot: string): string {
  return git(workspaceRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

export function getLocalBranches(workspaceRoot: string): string[] {
  const out = git(workspaceRoot, ['branch', '--format=%(refname:short)']);
  return out.split('\n').map(s => s.trim()).filter(Boolean);
}

export function detectDefaultBaseBranch(workspaceRoot: string): string {
  const branches = getLocalBranches(workspaceRoot);

  if (branches.includes('main')) return 'main';
  if (branches.includes('master')) return 'master';

  try {
    const upstream = git(workspaceRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    const remoteBase = upstream.replace(/^origin\//, '');
    if (remoteBase && branches.includes(remoteBase)) return remoteBase;
  } catch {
    // ignore
  }

  return branches[0] ?? '';
}
