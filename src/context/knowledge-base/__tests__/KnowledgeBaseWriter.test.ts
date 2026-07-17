import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KnowledgeBaseWriter } from '../KnowledgeBaseWriter';
import { KNOWLEDGE_BASE_ENTRIES_DIR } from '../types';
import type { NewKnowledgeBaseEntry } from '../types';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-kb-writer-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function baseEntry(overrides: Partial<NewKnowledgeBaseEntry> = {}): NewKnowledgeBaseEntry {
  return {
    mode: 'edit',
    providerId: 'nexus',
    originalPrompt: 'Fix the login bug',
    status: 'completed',
    changedFiles: [{ path: 'src/foo.ts', status: 'M' }],
    source: 'task-pipeline',
    ...overrides,
  };
}

describe('KnowledgeBaseWriter', () => {
  it('writes an entry file under .nexus/knowledge-base/entries/', async () => {
    const writer = new KnowledgeBaseWriter();
    const entry = await writer.write(tmp, baseEntry());

    const dir = path.join(tmp, KNOWLEDGE_BASE_ENTRIES_DIR);
    const files = fs.readdirSync(dir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^\d+-edit-[a-f0-9]{8}\.json$/);

    const content = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8'));
    expect(content.id).toBe(entry.id);
    expect(content.originalPrompt).toBe('Fix the login bug');
    expect(content.workspaceRoot).toBe(tmp);
  });

  it('leaves no leftover .tmp files after writing', async () => {
    const writer = new KnowledgeBaseWriter();
    await writer.write(tmp, baseEntry());

    const dir = path.join(tmp, KNOWLEDGE_BASE_ENTRIES_DIR);
    const files = fs.readdirSync(dir);
    expect(files.every(f => !f.endsWith('.tmp'))).toBe(true);
  });

  it('produces lexicographically sortable filenames by recency', async () => {
    const writer = new KnowledgeBaseWriter();
    await writer.write(tmp, baseEntry());
    await new Promise(r => setTimeout(r, 5));
    await writer.write(tmp, baseEntry());

    const dir = path.join(tmp, KNOWLEDGE_BASE_ENTRIES_DIR);
    const files = fs.readdirSync(dir).sort();
    const sortedDesc = [...files].sort().reverse();
    expect(sortedDesc[0]).toBe(files[files.length - 1]);
  });

  it('truncates very long prompts to the max length', async () => {
    const writer = new KnowledgeBaseWriter();
    const longPrompt = 'x'.repeat(5000);
    const entry = await writer.write(tmp, baseEntry({ originalPrompt: longPrompt }));
    expect(entry.originalPrompt.length).toBe(4000);
  });
});
