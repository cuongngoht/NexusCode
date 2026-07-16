import * as fs from 'fs';
import * as path from 'path';
import type { AgentMetadata, AgentPurpose, ReviewTargetKind } from '../application/agents/AgentMetadata';

export interface AgentPrompt {
  id: string;
  displayName: string;
  fileName: string;
  workspacePath: string;
}

const SAFE_AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/;

const BUNDLED_AGENTS_DIR = path.join('media', 'agents');

export function getWorkspaceAgentsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.nexus', 'agents');
}

export function ensureWorkspaceAgents(workspaceRoot: string, extensionRoot: string): void {
  const destDir = getWorkspaceAgentsDir(workspaceRoot);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const srcDir = path.join(extensionRoot, BUNDLED_AGENTS_DIR);
  if (!fs.existsSync(srcDir)) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const srcFile = path.join(srcDir, entry.name);
      const dest = path.join(destDir, entry.name);
      if (!fs.existsSync(dest)) {
        try { fs.copyFileSync(srcFile, dest); } catch { /* best effort */ }
      } else {
        // Sync frontmatter if workspace copy is missing it but bundled version has it
        syncFrontmatterIfMissing(srcFile, dest);
      }
    } else if (entry.isDirectory()) {
      const destFolder = path.join(destDir, entry.name);
      if (!fs.existsSync(destFolder)) {
        try { fs.cpSync(path.join(srcDir, entry.name), destFolder, { recursive: true }); } catch { /* best effort */ }
      } else {
        // Sync index.md frontmatter
        const srcIndex = path.join(srcDir, entry.name, 'index.md');
        const destIndex = path.join(destFolder, 'index.md');
        if (fs.existsSync(srcIndex) && fs.existsSync(destIndex)) {
          syncFrontmatterIfMissing(srcIndex, destIndex);
        }
      }
    }
  }
}

function hasFrontmatter(content: string): boolean {
  return /^---\r?\n[\s\S]*?\r?\n---/.test(content);
}

function extractFrontmatterBlock(content: string): string {
  const m = content.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/);
  return m ? m[1] : '';
}

function syncFrontmatterIfMissing(srcPath: string, destPath: string): void {
  try {
    const destContent = fs.readFileSync(destPath, 'utf8');
    if (hasFrontmatter(destContent)) return; // already has frontmatter — don't overwrite

    const srcContent = fs.readFileSync(srcPath, 'utf8');
    const srcFm = extractFrontmatterBlock(srcContent);
    if (!srcFm) return; // bundled version has no frontmatter either

    // Prepend bundled frontmatter to workspace copy
    fs.writeFileSync(destPath, srcFm + destContent, 'utf8');
  } catch {
    // best effort
  }
}

function extractDisplayName(filePath: string, id: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const firstLine = content.split('\n')[0] ?? '';
    const match = firstLine.match(/^#+\s+(.+)/);
    if (match) return match[1].trim();
  } catch {
    // fall through to id-based name
  }
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function listAgentPrompts(workspaceRoot: string): AgentPrompt[] {
  const dir = getWorkspaceAgentsDir(workspaceRoot);
  if (!fs.existsSync(dir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const prompts: AgentPrompt[] = [];
  for (const entry of entries) {
    if (entry.isFile()) {
      if (!entry.name.endsWith('.md')) continue;
      if (entry.name.startsWith('.')) continue;

      const id = entry.name.slice(0, -3);
      if (!SAFE_AGENT_ID_RE.test(id)) continue;

      const workspacePath = path.join(dir, entry.name);
      prompts.push({
        id,
        displayName: extractDisplayName(workspacePath, id),
        fileName: entry.name,
        workspacePath,
      });
    } else if (entry.isDirectory()) {
      const id = entry.name;
      if (!SAFE_AGENT_ID_RE.test(id)) continue;
      const indexPath = path.join(dir, id, 'index.md');
      if (!fs.existsSync(indexPath)) continue;
      prompts.push({
        id,
        displayName: extractDisplayName(indexPath, id),
        fileName: `${id}/index.md`,
        workspacePath: indexPath,
      });
    }
  }

  return prompts.sort((a, b) => a.id.localeCompare(b.id));
}

/** Returns relative paths of all .md files under dir, recursively, excluding dot-files. */
function collectMdFilesRecursive(dir: string, base = ''): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectMdFilesRecursive(path.join(dir, entry.name), rel));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(rel);
    }
  }
  return results;
}

export function loadAgentPromptMarkdown(workspaceRoot: string, agentId: string): string | undefined {
  if (!SAFE_AGENT_ID_RE.test(agentId)) return undefined;

  const agentsDir = getWorkspaceAgentsDir(workspaceRoot);
  const filePath = path.join(agentsDir, `${agentId}.md`);
  try { return fs.readFileSync(filePath, 'utf8'); } catch { /* fall through */ }

  // Folder agent: bundle index.md first, then all remaining .md files recursively (alphabetical by relative path)
  const agentDir = path.join(agentsDir, agentId);
  const indexPath = path.join(agentDir, 'index.md');
  if (!fs.existsSync(indexPath)) return undefined;

  try {
    const allMdFiles = collectMdFilesRecursive(agentDir);
    allMdFiles.sort((a, b) => {
      if (a === 'index.md') return -1;
      if (b === 'index.md') return 1;
      return a.localeCompare(b);
    });
    return allMdFiles
      .map(rel => fs.readFileSync(path.join(agentDir, rel), 'utf8'))
      .join('\n\n---\n\n');
  } catch { return undefined; }
}

export function loadAgentPromptBundle(workspaceRoot: string, agentIds: string[]): string {
  const seen = new Set<string>();
  const sections: string[] = [
    '# Nexus Agent Instructions',
    '',
    'The user selected these project agents. Follow their role instructions when answering.',
    '',
  ];

  for (const id of agentIds) {
    if (seen.has(id)) continue;
    seen.add(id);

    const content = loadAgentPromptMarkdown(workspaceRoot, id);
    if (!content) continue;

    sections.push(`## @${id}`);
    sections.push('');
    sections.push(content.trim());
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  return sections.join('\n');
}

/** Parse simple YAML frontmatter from markdown content. */
function parseFrontmatter(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Match frontmatter block at start of file
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return result;

  const lines = match[1].split(/\r?\n/);
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    // Array item
    const arrayItem = line.match(/^[ \t]+-\s*(.+)$/);
    if (arrayItem && currentArray !== null) {
      currentArray.push(arrayItem[1].trim());
      continue;
    }

    // If we were collecting an array, store it
    if (currentArray !== null && currentKey !== null) {
      result[currentKey] = currentArray;
      currentArray = null;
      currentKey = null;
    }

    // Key: value pair
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      const val = kv[2].trim();
      if (val === '') {
        // Starts an array block
        currentKey = key;
        currentArray = [];
      } else if (val === 'true') {
        result[key] = true;
      } else if (val === 'false') {
        result[key] = false;
      } else {
        result[key] = val;
      }
    }
  }

  // Flush pending array
  if (currentArray !== null && currentKey !== null) {
    result[currentKey] = currentArray;
  }

  return result;
}

function frontmatterToMetadata(id: string, fm: Record<string, unknown>, sourcePath: string, sourceKind: 'file' | 'folder-index'): AgentMetadata {
  return {
    id,
    name: typeof fm['name'] === 'string' ? fm['name'] : id,
    displayName: typeof fm['name'] === 'string' ? fm['name'] : undefined,
    description: typeof fm['description'] === 'string' ? fm['description'] : undefined,
    purpose: typeof fm['purpose'] === 'string' ? fm['purpose'] as AgentPurpose : undefined,
    capabilities: Array.isArray(fm['capabilities']) ? (fm['capabilities'] as string[]) : undefined,
    reviewTargets: Array.isArray(fm['reviewTargets']) ? (fm['reviewTargets'] as ReviewTargetKind[]) : undefined,
    requiresExplicitTarget: typeof fm['requiresExplicitTarget'] === 'boolean' ? fm['requiresExplicitTarget'] : undefined,
    sourcePath,
    sourceKind,
  };
}

export function loadAgentMetadata(workspaceRoot: string, agentId: string): AgentMetadata | null {
  if (!SAFE_AGENT_ID_RE.test(agentId)) return null;

  const agentsDir = getWorkspaceAgentsDir(workspaceRoot);

  // Try file agent first
  const filePath = path.join(agentsDir, `${agentId}.md`);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fm = parseFrontmatter(content);
      return frontmatterToMetadata(agentId, fm, filePath, 'file');
    } catch { /* fall through */ }
  }

  // Try folder agent
  const indexPath = path.join(agentsDir, agentId, 'index.md');
  if (fs.existsSync(indexPath)) {
    try {
      const content = fs.readFileSync(indexPath, 'utf8');
      const fm = parseFrontmatter(content);
      return frontmatterToMetadata(agentId, fm, indexPath, 'folder-index');
    } catch { /* fall through */ }
  }

  return null;
}

export function listAgentMetadata(workspaceRoot: string): AgentMetadata[] {
  const prompts = listAgentPrompts(workspaceRoot);
  return prompts
    .map(p => loadAgentMetadata(workspaceRoot, p.id))
    .filter((m): m is AgentMetadata => m !== null);
}
