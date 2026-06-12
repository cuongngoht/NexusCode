import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  createWorkflowAgentFile,
  isWorkspaceAgentsDir,
  normalizeAgentId,
  toDisplayName,
} from './workflowAgentCreator';

const EXTENSION_ROOT = path.join(__dirname, '../..');

function makeTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-workflow-agent-'));
}

describe('normalizeAgentId', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(normalizeAgentId('Release Manager')).toBe('release-manager');
  });

  it('strips .md extension', () => {
    expect(normalizeAgentId('qa_checklist.md')).toBe('qa_checklist');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeAgentId(' Portal Planner ')).toBe('portal-planner');
  });

  it('collapses path separators to hyphens', () => {
    expect(normalizeAgentId('agent/name')).toBe('agent-name');
  });

  it('strips leading dots from path traversal attempts', () => {
    expect(normalizeAgentId('../evil')).toBe('evil');
  });

  it('collapses multiple hyphens', () => {
    expect(normalizeAgentId('my--agent')).toBe('my-agent');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeAgentId('   ')).toBe('');
  });
});

describe('toDisplayName', () => {
  it('title-cases hyphen-separated words', () => {
    expect(toDisplayName('release-manager')).toBe('Release Manager');
  });

  it('title-cases underscore-separated words', () => {
    expect(toDisplayName('qa_checklist')).toBe('Qa Checklist');
  });
});

describe('isWorkspaceAgentsDir', () => {
  const root = '/workspace/project';

  it('returns true for exact .nexus/agents path', () => {
    expect(isWorkspaceAgentsDir(root, '/workspace/project/.nexus/agents')).toBe(true);
  });

  it('returns false for .nexus/skills', () => {
    expect(isWorkspaceAgentsDir(root, '/workspace/project/.nexus/skills')).toBe(false);
  });

  it('returns false for src/agents', () => {
    expect(isWorkspaceAgentsDir(root, '/workspace/project/src/agents')).toBe(false);
  });

  it('returns false for top-level agents folder', () => {
    expect(isWorkspaceAgentsDir(root, '/workspace/project/agents')).toBe(false);
  });

  it('returns false for subfolder of .nexus/agents', () => {
    expect(isWorkspaceAgentsDir(root, '/workspace/project/.nexus/agents/subfolder')).toBe(false);
  });

  it('returns false for similarly-named folder', () => {
    expect(isWorkspaceAgentsDir(root, '/workspace/project/.nexus/agents-backup')).toBe(false);
  });
});

describe('createWorkflowAgentFile', () => {
  it('creates a workflow agent folder with index.md, steps.md, context.md', () => {
    const root = makeTempWorkspace();
    const agentsDir = path.join(root, '.nexus', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const result = createWorkflowAgentFile({
      workspaceRoot: root,
      selectedFolderPath: agentsDir,
      rawName: 'Release Manager',
      extensionRoot: EXTENSION_ROOT,
    });

    const agentDir = path.join(agentsDir, 'release-manager');
    expect(result.agentId).toBe('release-manager');
    expect(result.alreadyExists).toBe(false);
    expect(result.filePath).toBe(path.join(agentDir, 'index.md'));

    // index.md — orchestrator
    expect(fs.existsSync(path.join(agentDir, 'index.md'))).toBe(true);
    const index = fs.readFileSync(path.join(agentDir, 'index.md'), 'utf8');
    expect(index).toContain('# Release Manager');
    expect(index).toContain('You are a Nexus workflow agent.');
    expect(index).toContain('steps.md');
    expect(index).toContain('context.md');

    // steps.md — step-by-step guide
    expect(fs.existsSync(path.join(agentDir, 'steps.md'))).toBe(true);
    const steps = fs.readFileSync(path.join(agentDir, 'steps.md'), 'utf8');
    expect(steps).toContain('# Release Manager — Steps');

    // context.md — project context
    expect(fs.existsSync(path.join(agentDir, 'context.md'))).toBe(true);
    const context = fs.readFileSync(path.join(agentDir, 'context.md'), 'utf8');
    expect(context).toContain('# Release Manager — Context');
  });

  it('substitutes {{displayName}} placeholder in all template files', () => {
    const root = makeTempWorkspace();
    const agentsDir = path.join(root, '.nexus', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    createWorkflowAgentFile({
      workspaceRoot: root,
      selectedFolderPath: agentsDir,
      rawName: 'Portal Planner',
      extensionRoot: EXTENSION_ROOT,
    });

    const agentDir = path.join(agentsDir, 'portal-planner');
    const index = fs.readFileSync(path.join(agentDir, 'index.md'), 'utf8');
    const steps = fs.readFileSync(path.join(agentDir, 'steps.md'), 'utf8');
    const context = fs.readFileSync(path.join(agentDir, 'context.md'), 'utf8');

    expect(index).not.toContain('{{displayName}}');
    expect(steps).not.toContain('{{displayName}}');
    expect(context).not.toContain('{{displayName}}');
    expect(index).toContain('Portal Planner');
    expect(steps).toContain('Portal Planner — Steps');
    expect(context).toContain('Portal Planner — Context');
  });

  it('returns alreadyExists: true and does not overwrite existing folder', () => {
    const root = makeTempWorkspace();
    const agentsDir = path.join(root, '.nexus', 'agents');
    const agentDir = path.join(agentsDir, 'release-manager');
    fs.mkdirSync(agentDir, { recursive: true });
    const indexPath = path.join(agentDir, 'index.md');
    fs.writeFileSync(indexPath, '# Existing Content', 'utf8');

    const result = createWorkflowAgentFile({
      workspaceRoot: root,
      selectedFolderPath: agentsDir,
      rawName: 'Release Manager',
      extensionRoot: EXTENSION_ROOT,
    });

    expect(result.alreadyExists).toBe(true);
    expect(result.filePath).toBe(indexPath);
    expect(fs.readFileSync(indexPath, 'utf8')).toBe('# Existing Content');
  });

  it('throws when selected path is not exactly .nexus/agents', () => {
    const root = makeTempWorkspace();
    const wrongDir = path.join(root, 'src', 'agents');
    fs.mkdirSync(wrongDir, { recursive: true });

    expect(() =>
      createWorkflowAgentFile({
        workspaceRoot: root,
        selectedFolderPath: wrongDir,
        rawName: 'bad-agent',
        extensionRoot: EXTENSION_ROOT,
      }),
    ).toThrow(/only be created inside .nexus\/agents/i);
  });

  it('throws for empty/invalid name after normalization', () => {
    const root = makeTempWorkspace();
    const agentsDir = path.join(root, '.nexus', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    expect(() =>
      createWorkflowAgentFile({
        workspaceRoot: root,
        selectedFolderPath: agentsDir,
        rawName: '   ',
        extensionRoot: EXTENSION_ROOT,
      }),
    ).toThrow(/invalid workflow agent name/i);
  });

  it('normalizes user input to safe filename', () => {
    const root = makeTempWorkspace();
    const agentsDir = path.join(root, '.nexus', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const result = createWorkflowAgentFile({
      workspaceRoot: root,
      selectedFolderPath: agentsDir,
      rawName: ' Portal Planner ',
      extensionRoot: EXTENSION_ROOT,
    });

    expect(result.agentId).toBe('portal-planner');
    expect(result.filePath).toContain(path.join('portal-planner', 'index.md'));
  });
});
