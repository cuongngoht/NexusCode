import * as fs from 'fs';
import * as path from 'path';

function toAscii(text: string): string {
  return text
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x00-\x7F]/g, '');
}

export function generateResearchSlug(problem: string): string {
  const base = toAscii(problem)
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  if (!base || base === '.' || base.startsWith('..')) {
    return 'research';
  }

  return base;
}

export function uniqueResearchSlug(workspaceRoot: string, problem: string): string {
  const base = generateResearchSlug(problem);
  const researchDir = path.join(workspaceRoot, '.nexus', 'research');

  if (!fs.existsSync(path.join(researchDir, base))) {
    return base;
  }

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`.slice(0, 48);
    if (!fs.existsSync(path.join(researchDir, candidate))) {
      return candidate;
    }
  }

  return `${base}-99`.slice(0, 48);
}
