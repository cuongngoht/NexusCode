import * as fs from 'fs';
import * as path from 'path';

export interface SkillPrompt {
  id: string;
  displayName: string;
  fileName: string;
  workspacePath: string;
}

const SAFE_SKILL_ID_RE = /^[a-zA-Z0-9_-]+$/;

const BUNDLED_SKILLS_DIR = path.join('media', 'skills');

export function getWorkspaceSkillsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.nexus', 'skills');
}

export function ensureWorkspaceSkills(workspaceRoot: string, extensionRoot: string): void {
  const destDir = getWorkspaceSkillsDir(workspaceRoot);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const srcDir = path.join(extensionRoot, BUNDLED_SKILLS_DIR);
  if (!fs.existsSync(srcDir)) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const dest = path.join(destDir, entry.name);
      if (!fs.existsSync(dest)) {
        try {
          fs.copyFileSync(path.join(srcDir, entry.name), dest);
        } catch {
          // best effort — skip files that fail to copy
        }
      }
    } else if (entry.isDirectory()) {
      const destFolder = path.join(destDir, entry.name);
      if (!fs.existsSync(destFolder)) {
        try {
          fs.cpSync(path.join(srcDir, entry.name), destFolder, { recursive: true });
        } catch {
          // best effort — skip folders that fail to copy
        }
      }
    }
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

export function listSkillPrompts(workspaceRoot: string): SkillPrompt[] {
  const dir = getWorkspaceSkillsDir(workspaceRoot);
  if (!fs.existsSync(dir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const prompts: SkillPrompt[] = [];
  for (const entry of entries) {
    if (entry.isFile()) {
      if (!entry.name.endsWith('.md')) continue;
      if (entry.name.startsWith('.')) continue;

      const id = entry.name.slice(0, -3);
      if (!SAFE_SKILL_ID_RE.test(id)) continue;

      const workspacePath = path.join(dir, entry.name);
      prompts.push({
        id,
        displayName: extractDisplayName(workspacePath, id),
        fileName: entry.name,
        workspacePath,
      });
    } else if (entry.isDirectory()) {
      const id = entry.name;
      if (!SAFE_SKILL_ID_RE.test(id)) continue;
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

export function loadSkillPromptMarkdown(workspaceRoot: string, skillId: string): string | undefined {
  if (!SAFE_SKILL_ID_RE.test(skillId)) return undefined;

  const skillsDir = getWorkspaceSkillsDir(workspaceRoot);
  const filePath = path.join(skillsDir, `${skillId}.md`);
  try { return fs.readFileSync(filePath, 'utf8'); } catch { /* fall through */ }

  // Folder skill: bundle index.md first, then remaining .md files alphabetically
  const skillDir = path.join(skillsDir, skillId);
  const indexPath = path.join(skillDir, 'index.md');
  if (!fs.existsSync(indexPath)) return undefined;

  try {
    const files = fs.readdirSync(skillDir)
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
      .sort((a, b) => a === 'index.md' ? -1 : b === 'index.md' ? 1 : a.localeCompare(b));
    return files
      .map(f => fs.readFileSync(path.join(skillDir, f), 'utf8'))
      .join('\n\n---\n\n');
  } catch { return undefined; }
}

export function loadSkillPromptBundle(workspaceRoot: string, skillIds: string[]): string {
  const seen = new Set<string>();
  const sections: string[] = [
    '# Nexus Skill Instructions',
    '',
    'The user selected these project skills. Follow their workflow instructions when answering.',
    '',
  ];

  for (const id of skillIds) {
    if (seen.has(id)) continue;
    seen.add(id);

    const content = loadSkillPromptMarkdown(workspaceRoot, id);
    if (!content) continue;

    sections.push(`## #${id}`);
    sections.push('');
    sections.push(content.trim());
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  return sections.join('\n');
}
