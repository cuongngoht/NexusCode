import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KnowledgeBaseWriter } from '../KnowledgeBaseWriter';
import { KnowledgeBaseLoader } from '../KnowledgeBaseLoader';
import { KNOWLEDGE_BASE_ENTRIES_DIR } from '../types';
import type { NewKnowledgeBaseEntry } from '../types';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-kb-loader-test-'));
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
    changedFiles: [],
    source: 'task-pipeline',
    ...overrides,
  };
}

describe('KnowledgeBaseLoader', () => {
  it('returns empty array when the entries dir does not exist', async () => {
    const loader = new KnowledgeBaseLoader();
    expect(await loader.loadRecentEntries(tmp)).toEqual([]);
  });

  it('loads entries most-recent-first', async () => {
    const writer = new KnowledgeBaseWriter();
    await writer.write(tmp, baseEntry({ originalPrompt: 'first' }));
    await new Promise(r => setTimeout(r, 5));
    await writer.write(tmp, baseEntry({ originalPrompt: 'second' }));

    const loader = new KnowledgeBaseLoader();
    const entries = await loader.loadRecentEntries(tmp);
    expect(entries.length).toBe(2);
    expect(entries[0].originalPrompt).toBe('second');
    expect(entries[1].originalPrompt).toBe('first');
  });

  it('skips corrupt entry files without throwing', async () => {
    const writer = new KnowledgeBaseWriter();
    await writer.write(tmp, baseEntry());

    const dir = path.join(tmp, KNOWLEDGE_BASE_ENTRIES_DIR);
    fs.writeFileSync(path.join(dir, '9999999999999-edit-corrupt.json'), 'not valid json', 'utf8');

    const loader = new KnowledgeBaseLoader();
    const entries = await loader.loadRecentEntries(tmp);
    expect(entries.length).toBe(1);
  });

  it('respects the limit option', async () => {
    const writer = new KnowledgeBaseWriter();
    for (let i = 0; i < 5; i++) {
      await writer.write(tmp, baseEntry({ originalPrompt: `entry-${i}` }));
      await new Promise(r => setTimeout(r, 2));
    }

    const loader = new KnowledgeBaseLoader();
    const entries = await loader.loadRecentEntries(tmp, { limit: 2 });
    expect(entries.length).toBe(2);
  });
});
