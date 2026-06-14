import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { CodeReviewTarget } from './CodeReviewTarget';

const DEFAULT_MAX_DIFF_CHARS = 60_000;
const DEFAULT_MAX_FILE_CONTEXT_CHARS = 25_000;

const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.nexus',
]);
const EXCLUDE_DIR_PREFIXES = ['media/webview'];

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2',
  '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.wav', '.pdf', '.zip',
  '.tar', '.gz', '.7z', '.exe', '.dll', '.so', '.dylib', '.vsix',
  '.lock',
]);

export interface CodeReviewProjectRules {
  rules?: string;
  codingStyle?: string;
  testingPolicy?: string;
  securityPolicy?: string;
  architecturePolicy?: string;
  oopPolicy?: string;
  designPatternPolicy?: string;
  reviewChecklist?: string;
}

export interface CodeReviewContext {
  target: CodeReviewTarget;
  baseBranch?: string;
  compareBranch?: string;
  currentBranch?: string;
  changedFiles: {
    path: string;
    status: string;
    additions?: number;
    deletions?: number;
  }[];
  diffStat?: string;
  diff: string;
  diffTruncated: boolean;
  changedCodeContext?: string;
  projectRules?: CodeReviewProjectRules;
}

export interface CodeReviewContextConfig {
  maxDiffChars?: number;
  maxFileContextChars?: number;
}

function tryReadFile(filePath: string): string | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content || undefined;
  } catch {
    return undefined;
  }
}

function git(cwd: string, args: string[], maxBuffer = 4 * 1024 * 1024): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer,
  }).trim();
}

function getGitArgs(target: CodeReviewTarget, baseBranch?: string): string[] {
  switch (target.type) {
    case 'branch': {
      const base = target.baseBranch ?? baseBranch ?? 'main';
      return ['diff', '-U5', '--find-renames', `${base}...HEAD`];
    }
    case 'working-tree':
      return ['diff', '-U5'];
    case 'staged':
      return ['diff', '--staged', '-U5'];
    case 'commit': {
      const sha = target.commitSha ?? 'HEAD';
      return ['diff', '-U5', `${sha}^`, sha];
    }
    case 'file': {
      const base = target.baseBranch ?? baseBranch ?? 'HEAD';
      const file = target.filePath ?? '';
      return ['diff', '-U5', base, '--', file];
    }
    case 'selection':
      return [];
    default:
      return ['diff', '-U5'];
  }
}

function getNameStatusArgs(target: CodeReviewTarget, baseBranch?: string): string[] {
  switch (target.type) {
    case 'branch': {
      const base = target.baseBranch ?? baseBranch ?? 'main';
      return ['diff', '--name-status', `${base}...HEAD`];
    }
    case 'working-tree':
      return ['diff', '--name-status'];
    case 'staged':
      return ['diff', '--staged', '--name-status'];
    case 'commit': {
      const sha = target.commitSha ?? 'HEAD';
      return ['diff', '--name-status', `${sha}^`, sha];
    }
    case 'file': {
      const base = target.baseBranch ?? baseBranch ?? 'HEAD';
      const file = target.filePath ?? '';
      return ['diff', '--name-status', base, '--', file];
    }
    default:
      return ['diff', '--name-status'];
  }
}

function parseNameStatus(output: string): Array<{ path: string; status: string }> {
  return output
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const parts = l.split(/\s+/);
      const status = parts[0] ?? 'M';
      const filePath = parts.slice(1).join(' ');
      return { status, path: filePath };
    })
    .filter(f => Boolean(f.path));
}

function isExcluded(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  if (parts.some(p => EXCLUDE_DIRS.has(p))) return true;
  if (EXCLUDE_DIR_PREFIXES.some(prefix => filePath.startsWith(prefix))) return true;
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  return false;
}

function loadProjectRules(workspaceRoot: string): CodeReviewProjectRules | undefined {
  const nexusDir = path.join(workspaceRoot, '.nexus');
  const ruleFiles: Array<[keyof CodeReviewProjectRules, string]> = [
    ['rules', 'rules.md'],
    ['codingStyle', 'coding-style.md'],
    ['testingPolicy', 'testing-policy.md'],
    ['securityPolicy', 'security-policy.md'],
    ['architecturePolicy', 'architecture-policy.md'],
    ['oopPolicy', 'oop-policy.md'],
    ['designPatternPolicy', 'design-pattern-policy.md'],
    ['reviewChecklist', 'review-checklist.md'],
  ];

  const result: CodeReviewProjectRules = {};
  let hasAny = false;
  for (const [key, file] of ruleFiles) {
    const content = tryReadFile(path.join(nexusDir, file));
    if (content) {
      result[key] = content;
      hasAny = true;
    }
  }
  return hasAny ? result : undefined;
}

function getCurrentBranch(workspaceRoot: string): string | undefined {
  try {
    return git(workspaceRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    return undefined;
  }
}

function buildChangedCodeContext(
  workspaceRoot: string,
  changedFiles: Array<{ path: string; status: string }>,
  baseBranch: string | undefined,
  maxChars: number,
): string | undefined {
  const sections: string[] = [];
  let total = 0;

  for (const f of changedFiles) {
    if (total >= maxChars) break;
    if (isExcluded(f.path)) continue;

    const ext = path.extname(f.path).toLowerCase();
    const sourceExts = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h',
      '.json', '.yaml', '.yml', '.toml', '.md', '.css', '.scss', '.html',
    ]);
    if (!sourceExts.has(ext)) continue;

    try {
      let excerpt = '';
      if (f.status === 'A') {
        const absPath = path.resolve(workspaceRoot, f.path);
        excerpt = fs.readFileSync(absPath, 'utf8').slice(0, 4000);
      } else if (baseBranch) {
        const rawDiff = git(
          workspaceRoot,
          ['diff', '-U80', `${baseBranch}...HEAD`, '--', f.path],
          2 * 1024 * 1024,
        );
        // Strip diff metadata lines
        const cleaned = rawDiff
          .split('\n')
          .filter(l => !l.startsWith('diff --git') && !l.startsWith('index ') &&
            !l.startsWith('--- ') && !l.startsWith('+++ ') && !/^@@.+@@/.test(l))
          .join('\n')
          .trim();
        excerpt = cleaned.slice(0, 4000);
      }

      if (!excerpt) continue;

      const lang = ext.replace('.', '') || 'text';
      const section = `### ${f.path}\n\`\`\`${lang}\n${excerpt}\n\`\`\``;
      sections.push(section);
      total += excerpt.length;
    } catch {
      // skip this file silently
    }
  }

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

export class CodeReviewContextBuilder {
  build(
    workspaceRoot: string,
    target: CodeReviewTarget,
    config?: CodeReviewContextConfig,
  ): CodeReviewContext {
    const maxDiffChars = config?.maxDiffChars ?? DEFAULT_MAX_DIFF_CHARS;
    const maxFileContextChars = config?.maxFileContextChars ?? DEFAULT_MAX_FILE_CONTEXT_CHARS;

    const currentBranch = getCurrentBranch(workspaceRoot);
    const baseBranch = target.baseBranch ?? (target.type === 'branch' ? undefined : undefined);
    const projectRules = loadProjectRules(workspaceRoot);

    // Selection mode: no git diff needed
    if (target.type === 'selection') {
      return {
        target,
        currentBranch,
        changedFiles: [],
        diff: target.selectedText ?? '',
        diffTruncated: false,
        projectRules,
      };
    }

    let changedFiles: Array<{ path: string; status: string }> = [];
    let diffStat: string | undefined;
    let diff = '';
    let diffTruncated = false;

    try {
      const nameStatusArgs = getNameStatusArgs(target, baseBranch);
      const nameStatusOut = git(workspaceRoot, nameStatusArgs);
      changedFiles = parseNameStatus(nameStatusOut).filter(f => !isExcluded(f.path));
    } catch {
      // proceed with empty list
    }

    try {
      const statArgs = getGitArgs(target, baseBranch).map(a =>
        a === '-U5' ? '--stat' : a,
      ).filter(a => a !== '--find-renames');
      diffStat = git(workspaceRoot, ['diff', '--stat', ...statArgs.slice(2)]);
    } catch {
      // not critical
    }

    try {
      const diffArgs = getGitArgs(target, baseBranch);
      if (diffArgs.length > 0) {
        const raw = git(workspaceRoot, diffArgs, 100 * 1024 * 1024);
        if (raw.length > maxDiffChars) {
          diff = raw.slice(0, maxDiffChars);
          diffTruncated = true;
        } else {
          diff = raw;
        }
      }
    } catch {
      diff = '';
    }

    const changedCodeContext = buildChangedCodeContext(
      workspaceRoot,
      changedFiles,
      baseBranch,
      maxFileContextChars,
    );

    return {
      target,
      baseBranch,
      compareBranch: currentBranch,
      currentBranch,
      changedFiles,
      diffStat,
      diff,
      diffTruncated,
      changedCodeContext,
      projectRules,
    };
  }
}
