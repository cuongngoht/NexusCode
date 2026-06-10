import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getWorkspaceSkillsDir,
  ensureWorkspaceSkills,
  listSkillPrompts,
  loadSkillPromptMarkdown,
  loadSkillPromptBundle,
} from '../skillPromptLibrary';

const EXTENSION_ROOT = path.join(__dirname, '../../..');

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getWorkspaceSkillsDir', () => {
  it('returns .nexus/skills under workspace root', () => {
    expect(getWorkspaceSkillsDir('/workspace')).toBe(
      path.join('/workspace', '.nexus', 'skills'),
    );
  });
});

describe('ensureWorkspaceSkills', () => {
  it('creates .nexus/skills when missing', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    expect(fs.existsSync(dir)).toBe(false);
    ensureWorkspaceSkills(tmpDir, EXTENSION_ROOT);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('copies bundled defaults into the skills dir', () => {
    ensureWorkspaceSkills(tmpDir, EXTENSION_ROOT);
    const dir = getWorkspaceSkillsDir(tmpDir);
    const files = fs.readdirSync(dir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every(f => f.endsWith('.md'))).toBe(true);
  });

  it('does not overwrite existing workspace skill files', () => {
    ensureWorkspaceSkills(tmpDir, EXTENSION_ROOT);
    const dir = getWorkspaceSkillsDir(tmpDir);
    const targetFile = path.join(dir, 'refactor.md');
    if (fs.existsSync(targetFile)) {
      const original = '# My custom refactor\nCustom content';
      fs.writeFileSync(targetFile, original, 'utf8');
      ensureWorkspaceSkills(tmpDir, EXTENSION_ROOT);
      const after = fs.readFileSync(targetFile, 'utf8');
      expect(after).toBe(original);
    }
  });
});

describe('listSkillPrompts', () => {
  it('returns empty array when .nexus/skills does not exist', () => {
    expect(listSkillPrompts(tmpDir)).toEqual([]);
  });

  it('lists only .md files, ignoring dotfiles and folders', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'skill-one.md'), '# Skill One\nContent', 'utf8');
    fs.writeFileSync(path.join(dir, 'skill-two.md'), '# Skill Two\nContent', 'utf8');
    fs.writeFileSync(path.join(dir, '.hidden.md'), '# Hidden', 'utf8');
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'not markdown', 'utf8');
    fs.mkdirSync(path.join(dir, 'subfolder'));

    const prompts = listSkillPrompts(tmpDir);
    const ids = prompts.map(p => p.id);
    expect(ids).toContain('skill-one');
    expect(ids).toContain('skill-two');
    expect(ids).not.toContain('.hidden');
    expect(ids).not.toContain('subfolder');
    expect(ids).not.toContain('readme');
  });

  it('derives id from filename (without .md)', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'my-skill.md'), 'Content', 'utf8');
    const prompts = listSkillPrompts(tmpDir);
    expect(prompts[0].id).toBe('my-skill');
    expect(prompts[0].fileName).toBe('my-skill.md');
  });

  it('extracts first markdown heading as displayName', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'refactor.md'), '# Refactor Skill\nContent', 'utf8');
    const prompts = listSkillPrompts(tmpDir);
    expect(prompts[0].displayName).toBe('Refactor Skill');
  });

  it('falls back to title-cased id when no heading', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'my-skill.md'), 'No heading here', 'utf8');
    const prompts = listSkillPrompts(tmpDir);
    expect(prompts[0].displayName).toBe('My Skill');
  });

  it('returns prompts sorted by id', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'zebra.md'), '# Z', 'utf8');
    fs.writeFileSync(path.join(dir, 'alpha.md'), '# A', 'utf8');
    const prompts = listSkillPrompts(tmpDir);
    expect(prompts[0].id).toBe('alpha');
    expect(prompts[1].id).toBe('zebra');
  });
});

describe('loadSkillPromptMarkdown', () => {
  it('returns content for a valid skill id', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'my-skill.md'), '# My Skill\nContent here', 'utf8');
    const result = loadSkillPromptMarkdown(tmpDir, 'my-skill');
    expect(result).toBe('# My Skill\nContent here');
  });

  it('returns undefined for missing skill', () => {
    expect(loadSkillPromptMarkdown(tmpDir, 'nonexistent')).toBeUndefined();
  });

  it('rejects unsafe skill ids', () => {
    expect(loadSkillPromptMarkdown(tmpDir, '../secret')).toBeUndefined();
    expect(loadSkillPromptMarkdown(tmpDir, 'skill/name')).toBeUndefined();
    expect(loadSkillPromptMarkdown(tmpDir, '/absolute')).toBeUndefined();
    expect(loadSkillPromptMarkdown(tmpDir, 'skill.md')).toBeUndefined();
  });
});

describe('loadSkillPromptBundle', () => {
  it('assembles a multi-skill prompt bundle', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'refactor.md'), '# Refactor Skill\nFocus on clean code.', 'utf8');
    fs.writeFileSync(path.join(dir, 'write-tests.md'), '# Write Tests Skill\nAdd coverage.', 'utf8');
    const bundle = loadSkillPromptBundle(tmpDir, ['refactor', 'write-tests']);
    expect(bundle).toContain('## #refactor');
    expect(bundle).toContain('## #write-tests');
    expect(bundle).toContain('Focus on clean code.');
    expect(bundle).toContain('Add coverage.');
    expect(bundle).toContain('# Nexus Skill Instructions');
  });

  it('deduplicates skill ids', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'refactor.md'), '# Refactor\nContent', 'utf8');
    const bundle = loadSkillPromptBundle(tmpDir, ['refactor', 'refactor', 'refactor']);
    const count = (bundle.match(/## #refactor/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('skips missing skills gracefully', () => {
    const dir = getWorkspaceSkillsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'refactor.md'), '# Refactor\nContent', 'utf8');
    const bundle = loadSkillPromptBundle(tmpDir, ['refactor', 'nonexistent']);
    expect(bundle).toContain('## #refactor');
    expect(bundle).not.toContain('## #nonexistent');
  });
});
