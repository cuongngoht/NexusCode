import * as fs from 'fs';
import * as path from 'path';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.yaml', '.yml', '.toml']);
const SKIP_DIRS = new Set(['node_modules', '.nexus', 'dist', 'build', 'out', '.git', 'coverage']);
const SKIP_DIR_PATHS = ['media/webview'];

const ENTRY_POINT_NAMES = ['extension.ts', 'index.ts', 'main.ts', 'App.tsx', 'app.ts', 'server.ts'];

const MAX_FILES = 20;
const MAX_FILE_CHARS = 1_500;
const MAX_TOTAL_CHARS = 25_000;

function isSkippedDir(rel: string): boolean {
  const parts = rel.split(path.sep);
  if (parts.some(p => SKIP_DIRS.has(p))) return true;
  return SKIP_DIR_PATHS.some(skip => rel.startsWith(skip));
}

function parseImportantFilesFromProjectMap(workspaceRoot: string, projectMap?: string): string[] {
  if (!projectMap) return [];
  const results: string[] = [];
  const section = projectMap.match(/## Important Files\n([\s\S]*?)(?=\n##|$)/);
  if (!section) return [];
  for (const line of section[1].split('\n')) {
    const m = line.match(/^-\s+(.+)$/);
    if (m) {
      const candidate = path.resolve(workspaceRoot, m[1].trim());
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        results.push(candidate);
      }
    }
  }
  return results;
}

function findEntryPoints(workspaceRoot: string): string[] {
  const found: string[] = [];
  try {
    for (const name of ENTRY_POINT_NAMES) {
      const p = path.join(workspaceRoot, name);
      if (fs.existsSync(p)) { found.push(p); break; }
    }
    const srcDir = path.join(workspaceRoot, 'src');
    if (fs.existsSync(srcDir)) {
      for (const name of ENTRY_POINT_NAMES) {
        const p = path.join(srcDir, name);
        if (fs.existsSync(p)) { found.push(p); break; }
      }
    }
  } catch { /* ignore */ }
  return found;
}

function collectKeyFiles(workspaceRoot: string, projectMap?: string): string[] {
  const seen = new Set<string>();
  const files: string[] = [];

  const add = (p: string) => {
    const norm = path.normalize(p);
    const rel = path.relative(workspaceRoot, norm);
    if (seen.has(norm)) return;
    if (isSkippedDir(rel)) return;
    if (!SOURCE_EXTENSIONS.has(path.extname(norm).toLowerCase())) return;
    try {
      if (!fs.statSync(norm).isFile()) return;
    } catch { return; }
    seen.add(norm);
    files.push(norm);
  };

  // 1. README
  for (const name of ['README.md', 'readme.md']) {
    const p = path.join(workspaceRoot, name);
    if (fs.existsSync(p)) { add(p); break; }
  }

  // 2. Important files from project map
  for (const p of parseImportantFilesFromProjectMap(workspaceRoot, projectMap)) add(p);

  // 3. Entry points
  for (const p of findEntryPoints(workspaceRoot)) add(p);

  return files.slice(0, MAX_FILES);
}

export class ReadSourceContextStep implements IPipelineStep {
  readonly label = 'read-source-context';

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    const files = collectKeyFiles(ctx.workspaceRoot, ctx.projectMap);
    const sections: string[] = [];
    let totalChars = 0;

    for (const filePath of files) {
      if (totalChars >= MAX_TOTAL_CHARS) break;
      try {
        const rel = path.relative(ctx.workspaceRoot, filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        const truncated = content.length > MAX_FILE_CHARS;
        if (truncated) content = content.slice(0, MAX_FILE_CHARS) + '\n... (truncated)';
        const ext = path.extname(filePath).replace('.', '') || 'text';
        sections.push(`### ${rel}\n\`\`\`${ext}\n${content}\n\`\`\``);
        totalChars += content.length;
      } catch { /* skip unreadable */ }
    }

    if (sections.length > 0) {
      ctx.sourceContext = sections.join('\n\n');
    }
  }
}
