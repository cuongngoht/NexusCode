import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadActiveResearch,
  saveActiveResearch,
  createActiveResearch,
  markCurrentStepDone,
  advanceToNextStep,
  listResearchTopics,
  type ActiveResearchState,
} from '../activeResearchStore';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-active-test-'));
  fs.mkdirSync(path.join(tmp, '.nexus', 'research'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('loadActiveResearch', () => {
  it('returns null when active.json does not exist', () => {
    expect(loadActiveResearch(tmp)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const p = path.join(tmp, '.nexus', 'research', 'active.json');
    fs.writeFileSync(p, 'not valid json', 'utf8');
    expect(loadActiveResearch(tmp)).toBeNull();
  });

  it('returns null for missing required fields', () => {
    const p = path.join(tmp, '.nexus', 'research', 'active.json');
    fs.writeFileSync(p, JSON.stringify({ problem: 'test' }), 'utf8');
    expect(loadActiveResearch(tmp)).toBeNull();
  });

  it('loads valid active state', () => {
    const state: ActiveResearchState = {
      researchId: 'my-research',
      problem: 'Design something',
      currentStep: '00-problem.md',
      completedSteps: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    saveActiveResearch(tmp, state);
    const loaded = loadActiveResearch(tmp);
    expect(loaded).not.toBeNull();
    expect(loaded?.researchId).toBe('my-research');
    expect(loaded?.currentStep).toBe('00-problem.md');
  });
});

describe('createActiveResearch', () => {
  it('writes active.json and returns state', () => {
    const state = createActiveResearch(tmp, 'test-topic', 'Design X');
    expect(state.researchId).toBe('test-topic');
    expect(state.currentStep).toBe('00-problem.md');
    expect(state.completedSteps).toEqual([]);
    const loaded = loadActiveResearch(tmp);
    expect(loaded?.researchId).toBe('test-topic');
  });
});

describe('markCurrentStepDone', () => {
  it('returns null when no active state', () => {
    expect(markCurrentStepDone(tmp)).toBeNull();
  });

  it('adds current step to completedSteps and advances', () => {
    const topicDir = path.join(tmp, '.nexus', 'research', 'my-topic');
    fs.mkdirSync(topicDir, { recursive: true });
    ['00-problem.md', '01-local-context.md', '02-options.md'].forEach(f =>
      fs.writeFileSync(path.join(topicDir, f), `# ${f}`, 'utf8'),
    );
    createActiveResearch(tmp, 'my-topic', 'Design X');

    const updated = markCurrentStepDone(tmp);
    expect(updated?.completedSteps).toContain('00-problem.md');
    expect(updated?.currentStep).toBe('01-local-context.md');
  });

  it('stays on last step when all are done', () => {
    const topicDir = path.join(tmp, '.nexus', 'research', 'my-topic');
    fs.mkdirSync(topicDir, { recursive: true });
    fs.writeFileSync(path.join(topicDir, '00-problem.md'), '# step 0', 'utf8');
    createActiveResearch(tmp, 'my-topic', 'Design X');

    const updated = markCurrentStepDone(tmp);
    expect(updated?.currentStep).toBe('00-problem.md');
    expect(updated?.completedSteps).toContain('00-problem.md');
  });
});

describe('advanceToNextStep', () => {
  it('advances without adding to completedSteps', () => {
    const topicDir = path.join(tmp, '.nexus', 'research', 'my-topic');
    fs.mkdirSync(topicDir, { recursive: true });
    ['00-problem.md', '01-local-context.md'].forEach(f =>
      fs.writeFileSync(path.join(topicDir, f), `# ${f}`, 'utf8'),
    );
    createActiveResearch(tmp, 'my-topic', 'Design X');

    const updated = advanceToNextStep(tmp);
    expect(updated?.currentStep).toBe('01-local-context.md');
    expect(updated?.completedSteps).toEqual([]);
  });
});

describe('listResearchTopics', () => {
  it('returns empty array when no research dir exists', () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nx-empty-'));
    try {
      expect(listResearchTopics(emptyRoot)).toEqual([]);
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  it('returns topic folder names', () => {
    const researchDir = path.join(tmp, '.nexus', 'research');
    fs.mkdirSync(path.join(researchDir, 'topic-a'), { recursive: true });
    fs.mkdirSync(path.join(researchDir, 'topic-b'), { recursive: true });
    const topics = listResearchTopics(tmp);
    expect(topics).toContain('topic-a');
    expect(topics).toContain('topic-b');
  });
});
