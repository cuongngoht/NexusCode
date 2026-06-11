import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadResearchContext } from '../researchFolderLoader';
import { createActiveResearch } from '../activeResearchStore';
import { createResearchTopic } from '../researchWorkflowCreator';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-loader-test-'));
  fs.mkdirSync(path.join(tmp, '.nexus', 'research'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('loadResearchContext', () => {
  it('returns null when prompt has no @research mention', () => {
    expect(loadResearchContext(tmp, 'normal prompt')).toBeNull();
  });

  it('creates orchestrator index.md if missing', () => {
    loadResearchContext(tmp, '@research create something new');
    const indexPath = path.join(tmp, '.nexus', 'research', 'index.md');
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('creates topic folder and active.json for new research', () => {
    const result = loadResearchContext(tmp, '@research Design a portal');
    expect(result).not.toBeNull();
    expect(result!.activeState.researchId).toBeTruthy();
    expect(result!.activeState.currentStep).toBe('00-problem.md');

    const activeJson = path.join(tmp, '.nexus', 'research', 'active.json');
    expect(fs.existsSync(activeJson)).toBe(true);
  });

  it('returns null for continue when no active research exists', () => {
    const result = loadResearchContext(tmp, '@research tiếp tục');
    expect(result).toBeNull();
  });

  it('loads existing active research on continue signal', () => {
    createResearchTopic(tmp, 'my-topic', 'Design X');
    createActiveResearch(tmp, 'my-topic', 'Design X');

    const result = loadResearchContext(tmp, '@research continue');
    expect(result).not.toBeNull();
    expect(result!.activeState.researchId).toBe('my-topic');
    expect(result!.currentStep).toBe('00-problem.md');
  });

  it('loads the current step file content', () => {
    createResearchTopic(tmp, 'my-topic', 'Design X');
    createActiveResearch(tmp, 'my-topic', 'Design X');

    const result = loadResearchContext(tmp, '@research');
    expect(result).not.toBeNull();
    expect(result!.currentStepContent).toContain('Step 00');
  });

  it('resolves assigned agent from step file', () => {
    createResearchTopic(tmp, 'my-topic', 'Design X');
    createActiveResearch(tmp, 'my-topic', 'Design X');

    const result = loadResearchContext(tmp, '@research');
    expect(result!.assignedAgent).toBe('research');
  });

  it('resolves software-architect agent for export step', () => {
    createResearchTopic(tmp, 'my-topic', 'Design X');
    createActiveResearch(tmp, 'my-topic', 'Design X');

    // Manually advance to step 05
    const state = {
      researchId: 'my-topic',
      problem: 'Design X',
      currentStep: '05-export-plan.md',
      completedSteps: ['00-problem.md'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    fs.writeFileSync(
      path.join(tmp, '.nexus', 'research', 'active.json'),
      JSON.stringify(state),
      'utf8',
    );

    const result = loadResearchContext(tmp, '@research');
    expect(result!.assignedAgent).toBe('software-architect');
  });

  it('injects cleaned prompt (without @research token) for new research', () => {
    const result = loadResearchContext(tmp, '@research Design a new feature');
    expect(result!.cleanedPrompt).toBe('Design a new feature');
  });

  it('provides continue message for continuation prompts', () => {
    createResearchTopic(tmp, 'my-topic', 'Design X');
    createActiveResearch(tmp, 'my-topic', 'Design X');

    const result = loadResearchContext(tmp, '@research tiếp tục');
    expect(result!.cleanedPrompt).toContain('Continue with the current research step');
  });
});
