import * as fs from 'fs';
import * as path from 'path';
import type { PromptAttachment } from '../core/types';

export type { PromptAttachment };

const MAX_FILES = 30;
const MAX_TOTAL_CHARS = 120_000;
const MAX_FILE_CHARS = 20_000;

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', 'coverage', '.next',
]);

const SECRET_PATTERNS = [/^\.env(\..+)?$/, /\.pem$/, /\.key$/, /^id_rsa/, /^id_ed25519/];

function isSecretFile(name: string): boolean {
  return SECRET_PATTERNS.some(p => p.test(name));
}

function isBinaryBuffer(buf: Buffer): boolean {
  const check = buf.slice(0, 512);
  for (let i = 0; i < check.length; i++) {
    if (check[i] === 0) return true;
  }
  return false;
}

function extToLang(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx',
    '.json': 'json', '.md': 'md', '.css': 'css', '.html': 'html',
    '.py': 'python', '.sh': 'bash', '.yaml': 'yaml', '.yml': 'yaml',
    '.toml': 'toml', '.rs': 'rust', '.go': 'go', '.java': 'java',
    '.c': 'c', '.cpp': 'cpp', '.h': 'c',
  };
  return map[ext] ?? '';
}

function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name) || name === 'runs';
}

function isSafePath(workspaceRoot: string, relPath: string): { safe: boolean; reason?: string } {
  if (path.isAbsolute(relPath)) {
    return { safe: false, reason: 'absolute paths are not allowed' };
  }
  if (relPath.includes('..')) {
    return { safe: false, reason: 'path traversal is not allowed' };
  }
  const resolved = path.resolve(workspaceRoot, relPath);
  if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
    return { safe: false, reason: 'path resolves outside workspace root' };
  }
  return { safe: true };
}

function formatFileBlock(relPath: string, content: string): string {
  const ext = path.extname(relPath);
  const lang = extToLang(ext);
  return `## ${relPath}\n\n\`\`\`${lang}\n${content}\n\`\`\``;
}

interface ReadState { totalChars: number; fileCount: number }

function readFileSafe(absPath: string, relPath: string, state: ReadState): string | null {
  if (state.fileCount >= MAX_FILES || state.totalChars >= MAX_TOTAL_CHARS) return null;

  const name = path.basename(relPath);
  if (isSecretFile(name)) return `<!-- skipped: ${relPath}: secret file -->`;

  let buf: Buffer;
  try {
    buf = fs.readFileSync(absPath);
  } catch {
    return null;
  }

  if (isBinaryBuffer(buf)) return `<!-- skipped: ${relPath}: binary file -->`;

  let content = buf.toString('utf8');
  let truncated = false;
  if (content.length > MAX_FILE_CHARS) {
    content = content.slice(0, MAX_FILE_CHARS);
    truncated = true;
  }

  state.totalChars += content.length;
  state.fileCount++;

  const block = formatFileBlock(relPath, content);
  return truncated ? block + '\n\n> *(file truncated)*' : block;
}

function collectFolderFiles(absDir: string, relDir: string, state: ReadState, results: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (state.fileCount >= MAX_FILES || state.totalChars >= MAX_TOTAL_CHARS) break;

    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name)) continue;
      collectFolderFiles(
        path.join(absDir, entry.name),
        path.join(relDir, entry.name),
        state,
        results,
      );
    } else if (entry.isFile()) {
      const block = readFileSafe(path.join(absDir, entry.name), path.join(relDir, entry.name), state);
      if (block) results.push(block);
    }
  }
}

/**
 * Return a flat list of workspace-relative file paths, respecting the same
 * ignore rules used during attachment reading. Capped at 2000 entries.
 */
export function listWorkspaceFiles(workspaceRoot: string): string[] {
  const results: string[] = [];

  function walk(absDir: string, relDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (isIgnoredDir(entry.name)) continue;
        walk(
          path.join(absDir, entry.name),
          relDir ? `${relDir}/${entry.name}` : entry.name,
        );
      } else if (entry.isFile()) {
        results.push(relDir ? `${relDir}/${entry.name}` : entry.name);
      }
    }
  }

  walk(workspaceRoot, '');
  return results;
}

/**
 * Parse `@path` references from the prompt. Ignores email-style `word@host` patterns.
 * Supports bare paths (`@src/App.tsx`) and quoted paths (`@"src/folder with spaces/file.ts"`).
 */
export function parsePromptAttachmentRefs(prompt: string): PromptAttachment[] {
  const seen = new Set<string>();
  const results: PromptAttachment[] = [];

  // Quoted refs first: @"some path"
  const quotedRe = /(?:^|\s)@"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = quotedRe.exec(prompt)) !== null) {
    const p = m[1].trim();
    if (p && !seen.has(p)) {
      seen.add(p);
      results.push({ type: 'file', path: p });
    }
  }

  // Plain refs: @path/to/file — must be preceded by whitespace or start of string
  // to avoid matching email addresses like user@host.com
  const stripped = prompt.replace(/(?:^|\s)@"[^"]*"/g, s => ' '.repeat(s.length));
  const plainRe = /(?:^|\s)@([\w./\\-]+)/g;
  while ((m = plainRe.exec(stripped)) !== null) {
    const p = m[1].trim();
    if (p && !seen.has(p)) {
      seen.add(p);
      results.push({ type: 'file', path: p });
    }
  }

  return results;
}

/**
 * Resolve all attachments (explicit + @ref parsed) and return a markdown block
 * with file/folder contents, ready to inject into the enhanced prompt.
 */
export function buildPromptAttachmentContext(
  workspaceRoot: string,
  prompt: string,
  attachments: PromptAttachment[],
): string {
  const refs = parsePromptAttachmentRefs(prompt);

  // Merge explicit attachments + parsed refs, deduplicating by path
  const seen = new Set<string>();
  const all: PromptAttachment[] = [];
  for (const a of [...attachments, ...refs]) {
    if (!seen.has(a.path)) {
      seen.add(a.path);
      all.push(a);
    }
  }

  if (all.length === 0) return '';

  const state: ReadState = { totalChars: 0, fileCount: 0 };
  const blocks: string[] = [];
  const skipped: string[] = [];

  for (const att of all) {
    if (state.fileCount >= MAX_FILES || state.totalChars >= MAX_TOTAL_CHARS) {
      skipped.push(`\`${att.path}\`: limit reached`);
      continue;
    }

    const safety = isSafePath(workspaceRoot, att.path);
    if (!safety.safe) {
      skipped.push(`\`${att.path}\`: rejected — ${safety.reason}`);
      continue;
    }

    const absPath = path.resolve(workspaceRoot, att.path);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch {
      skipped.push(`\`${att.path}\`: not found`);
      continue;
    }

    if (stat.isFile()) {
      const block = readFileSafe(absPath, att.path, state);
      if (block) {
        blocks.push(block);
      } else {
        skipped.push(`\`${att.path}\`: limit reached`);
      }
    } else if (stat.isDirectory()) {
      const before = blocks.length;
      collectFolderFiles(absPath, att.path, state, blocks);
      if (blocks.length === before) {
        skipped.push(`\`${att.path}\`: folder empty or all files skipped`);
      }
    }
  }

  const parts: string[] = [...blocks];
  if (skipped.length > 0) {
    parts.push('\n## Skipped\n\n' + skipped.map(s => `- ${s}`).join('\n'));
  }

  return parts.join('\n\n');
}
