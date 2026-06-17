import * as fs from 'fs';
import * as path from 'path';

export interface CommandDef {
  id: string;
  description: string;
  promptTemplate: string;
}

const SAFE_COMMAND_ID_RE = /^[a-zA-Z0-9_-]+$/;

const BUNDLED_COMMANDS_DIR = path.join('media', 'commands');

export function getWorkspaceCommandsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.nexus', 'commands');
}

export function ensureWorkspaceCommands(workspaceRoot: string, extensionRoot: string): void {
  const destDir = getWorkspaceCommandsDir(workspaceRoot);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const srcDir = path.join(extensionRoot, BUNDLED_COMMANDS_DIR);
  if (!fs.existsSync(srcDir)) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const dest = path.join(destDir, entry.name);
    if (!fs.existsSync(dest)) {
      try {
        fs.copyFileSync(path.join(srcDir, entry.name), dest);
      } catch {
        // best effort
      }
    }
  }
}

function parseFrontmatter(content: string): { description: string; body: string } {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return { description: '', body: content.trim() };

  const fm = fmMatch[1] ?? '';
  const body = (fmMatch[2] ?? '').trim();
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  return {
    description: descMatch ? descMatch[1].trim() : '',
    body,
  };
}

export function listCommandDefs(workspaceRoot: string): CommandDef[] {
  const dir = getWorkspaceCommandsDir(workspaceRoot);
  if (!fs.existsSync(dir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const defs: CommandDef[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name.startsWith('.')) continue;

    const id = entry.name.slice(0, -3);
    if (!SAFE_COMMAND_ID_RE.test(id)) continue;

    try {
      const raw = fs.readFileSync(path.join(dir, entry.name), 'utf8');
      const { description, body } = parseFrontmatter(raw);
      defs.push({ id, description, promptTemplate: body });
    } catch {
      // skip unreadable files
    }
  }

  return defs.sort((a, b) => a.id.localeCompare(b.id));
}

export function loadCommandPromptMarkdown(workspaceRoot: string, commandId: string): string | undefined {
  if (!SAFE_COMMAND_ID_RE.test(commandId)) {
    return undefined;
  }
  const workspacePath = path.join(getWorkspaceCommandsDir(workspaceRoot), `${commandId}.md`);
  try {
    const raw = fs.readFileSync(workspacePath, 'utf8');
    const parsed = parseFrontmatter(raw);
    return parsed.body.trim() || undefined;
  } catch {
    return undefined;
  }
}
