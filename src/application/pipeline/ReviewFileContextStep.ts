import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';
import { detectDefaultBaseBranch } from '../../git/gitBranch';

const MAX_FILE_CHARS = 5_000;
const MAX_TOTAL_CHARS = 25_000;
const PER_FILE_DIFF_MAX_BUFFER = 2 * 1024 * 1024; // 2 MB

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h',
  '.json', '.yaml', '.yml', '.toml', '.md', '.css', '.scss', '.html',
]);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.nexus']);
const SKIP_DIR_PATHS = ['media/webview'];

function isSkipped(rel: string): boolean {
  const parts = rel.split(path.sep);
  if (parts.some(p => SKIP_DIRS.has(p))) return true;
  return SKIP_DIR_PATHS.some(skip => rel.startsWith(skip));
}

interface FileStatus {
  status: string;
  rel: string;
}

function getChangedFileStatuses(workspaceRoot: string, baseBranch: string): FileStatus[] {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--name-status', `${baseBranch}...HEAD`],
      { cwd: workspaceRoot, encoding: 'utf8', timeout: 5_000, stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();

    return output
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .filter(l => !l.startsWith('D'))
      .map(l => {
        const parts = l.split(/\s+/);
        const status = parts[0];
        const rel = parts.slice(1).join(' ');
        return { status, rel };
      })
      .filter(f => Boolean(f.rel));
  } catch {
    return [];
  }
}

function parseDiffToExcerpt(rawDiff: string): string {
  const lines = rawDiff.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith('diff --git ')) continue;
    if (line.startsWith('index ')) continue;
    if (line.startsWith('--- ') || line.startsWith('+++ ')) continue;
    if (/^@@.+@@/.test(line)) continue;
    if (/^Binary files/.test(line)) return '';
    if (line === '\\ No newline at end of file') continue;
    result.push(line);
  }

  return result.join('\n').trim();
}

function getDiffExcerpt(
  workspaceRoot: string,
  base: string,
  rel: string,
  status: string,
): string | null {
  if (status === 'A') {
    // Added file — no base to diff against, read file directly
    try {
      const abs = path.resolve(workspaceRoot, rel);
      const content = fs.readFileSync(abs, 'utf8');
      return content.slice(0, MAX_FILE_CHARS);
    } catch {
      return null;
    }
  }

  try {
    const rawDiff = execFileSync(
      'git',
      ['diff', '-U80', `${base}...HEAD`, '--', rel],
      {
        cwd: workspaceRoot,
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: PER_FILE_DIFF_MAX_BUFFER,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const excerpt = parseDiffToExcerpt(rawDiff);
    return excerpt === '' ? null : excerpt;
  } catch {
    return null;
  }
}

export class ReviewFileContextStep implements IPipelineStep {
  readonly label = 'review-files';

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    if (ctx.reviewTarget && ctx.reviewTarget.type !== 'branch') return;

    const base = ctx.baseBranch || detectDefaultBaseBranch(ctx.workspaceRoot);
    if (!base) return;
    ctx.baseBranch = base;
    ctx.reviewTarget = ctx.reviewTarget
      ? { ...ctx.reviewTarget, baseBranch: ctx.reviewTarget.baseBranch ?? base }
      : { type: 'branch', baseBranch: base };

    const changedFiles = getChangedFileStatuses(ctx.workspaceRoot, base);
    if (changedFiles.length === 0) return;

    const sections: string[] = [];
    let totalChars = 0;

    for (const { status, rel } of changedFiles) {
      if (totalChars >= MAX_TOTAL_CHARS) break;
      if (!SOURCE_EXTENSIONS.has(path.extname(rel).toLowerCase())) continue;
      if (isSkipped(rel)) continue;

      let excerpt = getDiffExcerpt(ctx.workspaceRoot, base, rel, status);
      if (excerpt === null) continue;

      if (excerpt.length > MAX_FILE_CHARS) {
        excerpt = excerpt.slice(0, MAX_FILE_CHARS) + '\n... (truncated)';
      }

      const ext = path.extname(rel).replace('.', '') || 'text';
      sections.push(`### ${rel}\n\`\`\`${ext}\n${excerpt}\n\`\`\``);
      totalChars += excerpt.length;
    }

    if (sections.length > 0) {
      ctx.reviewFileContents = sections.join('\n\n');
    }
  }
}
