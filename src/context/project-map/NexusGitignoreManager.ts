import * as fs from 'fs';
import * as path from 'path';

const NEXUS_ENTRY = '.nexus/';
const NEXUS_MARKER = '# Added by Nexus AI Code';

/**
 * Ensures `.nexus/` is present in the root `.gitignore`.
 * Idempotent — does nothing if the entry already exists.
 * Returns true if the file was modified, false otherwise.
 */
export function ensureNexusInGitignore(workspaceRoot: string): boolean {
  const gitignorePath = path.join(workspaceRoot, '.gitignore');

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    // Already present — any of: ".nexus", ".nexus/", ".nexus/*"
    if (/^\.nexus[/]?$/m.test(content)) return false;
    fs.appendFileSync(gitignorePath, `\n${NEXUS_MARKER}\n${NEXUS_ENTRY}\n`, 'utf8');
  } else {
    fs.writeFileSync(gitignorePath, `${NEXUS_MARKER}\n${NEXUS_ENTRY}\n`, 'utf8');
  }
  return true;
}

/**
 * Removes the `.nexus/` entry (and its marker comment) added by Nexus.
 * Leaves any pre-existing `.nexus` entries untouched.
 */
export function removeNexusFromGitignore(workspaceRoot: string): boolean {
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return false;

  const original = fs.readFileSync(gitignorePath, 'utf8');
  const cleaned = original
    .replace(new RegExp(`\\n?${NEXUS_MARKER}\\n\\.nexus/\\n?`, 'g'), '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned === original.trim()) return false;
  fs.writeFileSync(gitignorePath, cleaned + '\n', 'utf8');
  return true;
}
