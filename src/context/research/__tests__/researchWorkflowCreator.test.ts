import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createResearchTopic } from '../researchWorkflowCreator';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-creator-test-'));
  fs.mkdirSync(path.join(tmp, '.nexus', 'research'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('createResearchTopic', () => {
  it('creates topic folder with all step files', () => {
    createResearchTopic(tmp, 'my-topic', 'Design something');
    const topicDir = path.join(tmp, '.nexus', 'research', 'my-topic');

    expect(fs.existsSync(path.join(topicDir, '00-problem.md'))).toBe(true);
    expect(fs.existsSync(path.join(topicDir, '01-local-context.md'))).toBe(true);
    expect(fs.existsSync(path.join(topicDir, '02-options.md'))).toBe(true);
    expect(fs.existsSync(path.join(topicDir, '03-tradeoffs.md'))).toBe(true);
    expect(fs.existsSync(path.join(topicDir, '04-recommendation.md'))).toBe(true);
    expect(fs.existsSync(path.join(topicDir, '05-export-plan.md'))).toBe(true);
    expect(fs.existsSync(path.join(topicDir, 'sources.md'))).toBe(true);
    expect(fs.existsSync(path.join(topicDir, 'notes.md'))).toBe(true);
  });

  it('injects the problem into 00-problem.md', () => {
    createResearchTopic(tmp, 'my-topic', 'Thiết kế folder agent portal');
    const content = fs.readFileSync(
      path.join(tmp, '.nexus', 'research', 'my-topic', '00-problem.md'),
      'utf8',
    );
    expect(content).toContain('Thiết kế folder agent portal');
  });

  it('does not overwrite existing step files', () => {
    const topicDir = path.join(tmp, '.nexus', 'research', 'my-topic');
    fs.mkdirSync(topicDir, { recursive: true });
    fs.writeFileSync(path.join(topicDir, '00-problem.md'), '# existing content', 'utf8');

    createResearchTopic(tmp, 'my-topic', 'New problem');

    const content = fs.readFileSync(path.join(topicDir, '00-problem.md'), 'utf8');
    expect(content).toBe('# existing content');
  });

  it('each step file has the @research or @software-architect agent heading', () => {
    createResearchTopic(tmp, 'my-topic', 'Test problem');
    const topicDir = path.join(tmp, '.nexus', 'research', 'my-topic');

    for (const step of ['00-problem.md', '01-local-context.md', '02-options.md']) {
      const content = fs.readFileSync(path.join(topicDir, step), 'utf8');
      expect(content).toContain('@research');
    }

    const exportStep = fs.readFileSync(path.join(topicDir, '05-export-plan.md'), 'utf8');
    expect(exportStep).toContain('@software-architect');
  });
});
