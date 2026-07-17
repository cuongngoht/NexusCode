import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleUsageProjector } from '../ModuleUsageProjector';
import { MODULE_USAGE_FILE, MAX_RECENT_SUMMARIES, MAX_WARNINGS } from '../moduleUsageTypes';
import type { KnowledgeBaseEntry } from '../types';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-module-usage-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeEntry(overrides: Partial<KnowledgeBaseEntry> = {}): KnowledgeBaseEntry {
  return {
    version: 1,
    schemaVersion: 'knowledge-base-entry-v1',
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    workspaceRoot: tmp,
    mode: 'edit',
    providerId: 'nexus',
    originalPrompt: 'Fix the bug',
    status: 'completed',
    changedFiles: [{ path: 'src/core/Foo.ts', status: 'M' }],
    source: 'task-pipeline',
    ...overrides,
  };
}

describe('ModuleUsageProjector', () => {
  it('increments touchCount for each changed file', async () => {
    const projector = new ModuleUsageProjector();
    await projector.project(tmp, makeEntry());

    const index = await projector.load(tmp);
    expect(index?.modules['src/core/Foo.ts'].touchCount).toBe(1);
  });

  it('accumulates touchCount across multiple entries', async () => {
    const projector = new ModuleUsageProjector();
    await projector.project(tmp, makeEntry());
    await projector.project(tmp, makeEntry());

    const index = await projector.load(tmp);
    expect(index?.modules['src/core/Foo.ts'].touchCount).toBe(2);
  });

  it('caps recentSummaries at MAX_RECENT_SUMMARIES, newest first', async () => {
    const projector = new ModuleUsageProjector();
    for (let i = 0; i < MAX_RECENT_SUMMARIES + 3; i++) {
      await projector.project(tmp, makeEntry({ implementationSummary: `summary-${i}` }));
    }

    const index = await projector.load(tmp);
    const record = index?.modules['src/core/Foo.ts'];
    expect(record?.recentSummaries).toHaveLength(MAX_RECENT_SUMMARIES);
    expect(record?.recentSummaries[0].summary).toBe(`summary-${MAX_RECENT_SUMMARIES + 2}`);
  });

  it('caps recentWarnings at MAX_WARNINGS, newest first', async () => {
    const projector = new ModuleUsageProjector();
    await projector.project(tmp, makeEntry({ warnings: ['w1', 'w2'] }));
    await projector.project(tmp, makeEntry({ warnings: ['w3', 'w4'] }));

    const index = await projector.load(tmp);
    const record = index?.modules['src/core/Foo.ts'];
    expect(record?.recentWarnings).toHaveLength(MAX_WARNINGS);
    // Newest batch (w3, w4) comes first; the oldest batch's own order (w1, w2) is preserved
    // when filling remaining slots, so w2 — not w1 — is the one dropped by the cap.
    expect(record?.recentWarnings.map(w => w.warning)).toEqual(['w3', 'w4', 'w1']);
  });

  it('dedups via seenTaskIds — projecting the same entry twice does not double-count', async () => {
    const projector = new ModuleUsageProjector();
    const entry = makeEntry();
    await projector.project(tmp, entry);
    await projector.project(tmp, entry);

    const index = await projector.load(tmp);
    expect(index?.modules['src/core/Foo.ts'].touchCount).toBe(1);
  });

  it('synthesizes a summary line when implementationSummary is absent', async () => {
    const projector = new ModuleUsageProjector();
    await projector.project(tmp, makeEntry({ mode: 'debug', status: 'completed', implementationSummary: undefined }));

    const index = await projector.load(tmp);
    expect(index?.modules['src/core/Foo.ts'].recentSummaries[0].summary).toBe('debug — completed');
  });

  it('writes the sidecar file under the expected path', async () => {
    const projector = new ModuleUsageProjector();
    await projector.project(tmp, makeEntry());
    expect(fs.existsSync(path.join(tmp, MODULE_USAGE_FILE))).toBe(true);
  });

  it('tracks separate modules independently', async () => {
    const projector = new ModuleUsageProjector();
    await projector.project(tmp, makeEntry({
      changedFiles: [{ path: 'src/core/Foo.ts', status: 'M' }, { path: 'src/application/Bar.ts', status: 'A' }],
    }));

    const index = await projector.load(tmp);
    expect(index?.modules['src/core/Foo.ts'].touchCount).toBe(1);
    expect(index?.modules['src/application/Bar.ts'].touchCount).toBe(1);
  });
});
