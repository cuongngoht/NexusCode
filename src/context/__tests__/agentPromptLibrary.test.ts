import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getWorkspaceAgentsDir,
  ensureWorkspaceAgents,
  listAgentPrompts,
  loadAgentPromptMarkdown,
  loadAgentPromptBundle,
} from '../agentPromptLibrary';

const EXTENSION_ROOT = path.join(__dirname, '../../..');

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-agent-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getWorkspaceAgentsDir', () => {
  it('returns .nexus/agents under workspace root', () => {
    expect(getWorkspaceAgentsDir('/workspace')).toBe(
      path.join('/workspace', '.nexus', 'agents'),
    );
  });
});

describe('ensureWorkspaceAgents', () => {
  it('creates .nexus/agents when missing', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    expect(fs.existsSync(dir)).toBe(false);
    ensureWorkspaceAgents(tmpDir, EXTENSION_ROOT);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('copies bundled defaults into the agents dir', () => {
    ensureWorkspaceAgents(tmpDir, EXTENSION_ROOT);
    const dir = getWorkspaceAgentsDir(tmpDir);
    const files = fs.readdirSync(dir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every(f => f.endsWith('.md'))).toBe(true);
  });

  it('does not overwrite existing workspace files', () => {
    ensureWorkspaceAgents(tmpDir, EXTENSION_ROOT);
    const dir = getWorkspaceAgentsDir(tmpDir);
    const targetFile = path.join(dir, 'software-architect.md');
    if (fs.existsSync(targetFile)) {
      const original = '# My custom architect\nCustom content';
      fs.writeFileSync(targetFile, original, 'utf8');
      ensureWorkspaceAgents(tmpDir, EXTENSION_ROOT);
      const after = fs.readFileSync(targetFile, 'utf8');
      expect(after).toBe(original);
    }
  });
});

describe('listAgentPrompts', () => {
  it('returns empty array when .nexus/agents does not exist', () => {
    expect(listAgentPrompts(tmpDir)).toEqual([]);
  });

  it('lists only .md files, ignoring dotfiles and folders', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'agent-one.md'), '# Agent One\nContent', 'utf8');
    fs.writeFileSync(path.join(dir, 'agent-two.md'), '# Agent Two\nContent', 'utf8');
    fs.writeFileSync(path.join(dir, '.hidden.md'), '# Hidden', 'utf8');
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'not markdown', 'utf8');
    fs.mkdirSync(path.join(dir, 'subfolder'));

    const prompts = listAgentPrompts(tmpDir);
    const ids = prompts.map(p => p.id);
    expect(ids).toContain('agent-one');
    expect(ids).toContain('agent-two');
    expect(ids).not.toContain('.hidden');
    expect(ids).not.toContain('subfolder');
    expect(ids).not.toContain('readme');
  });

  it('derives id from filename (without .md)', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'my-agent.md'), 'Content', 'utf8');
    const prompts = listAgentPrompts(tmpDir);
    expect(prompts[0].id).toBe('my-agent');
    expect(prompts[0].fileName).toBe('my-agent.md');
  });

  it('extracts first markdown heading as displayName', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'senior-dev.md'), '# Senior Developer Agent\nContent', 'utf8');
    const prompts = listAgentPrompts(tmpDir);
    expect(prompts[0].displayName).toBe('Senior Developer Agent');
  });

  it('falls back to title-cased id when no heading', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'my-agent.md'), 'No heading here', 'utf8');
    const prompts = listAgentPrompts(tmpDir);
    expect(prompts[0].displayName).toBe('My Agent');
  });

  it('returns prompts sorted by id', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'zebra.md'), '# Z', 'utf8');
    fs.writeFileSync(path.join(dir, 'alpha.md'), '# A', 'utf8');
    const prompts = listAgentPrompts(tmpDir);
    expect(prompts[0].id).toBe('alpha');
    expect(prompts[1].id).toBe('zebra');
  });
});

describe('loadAgentPromptMarkdown', () => {
  it('returns content for a valid agent id', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'my-agent.md'), '# My Agent\nContent here', 'utf8');
    const result = loadAgentPromptMarkdown(tmpDir, 'my-agent');
    expect(result).toBe('# My Agent\nContent here');
  });

  it('returns undefined for missing agent', () => {
    expect(loadAgentPromptMarkdown(tmpDir, 'nonexistent')).toBeUndefined();
  });

  it('rejects unsafe agent ids', () => {
    expect(loadAgentPromptMarkdown(tmpDir, '../secret')).toBeUndefined();
    expect(loadAgentPromptMarkdown(tmpDir, 'agent/name')).toBeUndefined();
    expect(loadAgentPromptMarkdown(tmpDir, '/absolute')).toBeUndefined();
    expect(loadAgentPromptMarkdown(tmpDir, 'agent.md')).toBeUndefined();
  });
});

describe('loadAgentPromptBundle', () => {
  it('assembles a multi-agent prompt bundle', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'arch.md'), '# Architect\nBe an architect.', 'utf8');
    fs.writeFileSync(path.join(dir, 'tester.md'), '# Tester\nBe a tester.', 'utf8');
    const bundle = loadAgentPromptBundle(tmpDir, ['arch', 'tester']);
    expect(bundle).toContain('## @arch');
    expect(bundle).toContain('## @tester');
    expect(bundle).toContain('Be an architect.');
    expect(bundle).toContain('Be a tester.');
    expect(bundle).toContain('# Nexus Agent Instructions');
  });

  it('deduplicates agent ids', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'arch.md'), '# Architect\nContent', 'utf8');
    const bundle = loadAgentPromptBundle(tmpDir, ['arch', 'arch', 'arch']);
    const count = (bundle.match(/## @arch/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('skips missing agents gracefully', () => {
    const dir = getWorkspaceAgentsDir(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'arch.md'), '# Architect\nContent', 'utf8');
    const bundle = loadAgentPromptBundle(tmpDir, ['arch', 'nonexistent']);
    expect(bundle).toContain('## @arch');
    expect(bundle).not.toContain('## @nonexistent');
  });
});
