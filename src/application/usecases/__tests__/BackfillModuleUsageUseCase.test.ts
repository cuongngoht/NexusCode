import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BackfillModuleUsageUseCase } from '../BackfillModuleUsageUseCase';
import { KnowledgeBaseWriter } from '../../../context/knowledge-base/KnowledgeBaseWriter';
import { ModuleUsageProjector } from '../../../context/knowledge-base/ModuleUsageProjector';
import { MODULE_USAGE_FILE } from '../../../context/knowledge-base/moduleUsageTypes';
import type { NewKnowledgeBaseEntry } from '../../../context/knowledge-base/types';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-backfill-usage-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function baseEntry(overrides: Partial<NewKnowledgeBaseEntry> = {}): NewKnowledgeBaseEntry {
  return {
    mode: 'edit',
    providerId: 'nexus',
    originalPrompt: 'Fix the bug',
    status: 'completed',
    changedFiles: [{ path: 'src/core/Foo.ts', status: 'M' }],
    source: 'task-pipeline',
    ...overrides,
  };
}

describe('BackfillModuleUsageUseCase', () => {
  it('projects all historical entries in chronological order when no sidecar exists yet', async () => {
    const writer = new KnowledgeBaseWriter();
    await writer.write(tmp, baseEntry({ implementationSummary: 'first change' }));
    await new Promise(r => setTimeout(r, 2));
    await writer.write(tmp, baseEntry({ implementationSummary: 'second change' }));

    const useCase = new BackfillModuleUsageUseCase();
    const result = await useCase.execute(tmp);

    expect(result.backfilled).toBe(true);
    expect(result.entriesProjected).toBe(2);

    const projector = new ModuleUsageProjector();
    const index = await projector.load(tmp);
    const record = index?.modules['src/core/Foo.ts'];
    expect(record?.touchCount).toBe(2);
    // Chronological projection means the most recent entry ends up first in recentSummaries.
    expect(record?.recentSummaries[0].summary).toBe('second change');
  });

  it('skips backfill if the sidecar already exists', async () => {
    const writer = new KnowledgeBaseWriter();
    await writer.write(tmp, baseEntry());

    const projector = new ModuleUsageProjector();
    await projector.project(tmp, await writer.write(tmp, baseEntry()));
    expect(fs.existsSync(path.join(tmp, MODULE_USAGE_FILE))).toBe(true);

    const useCase = new BackfillModuleUsageUseCase();
    const result = await useCase.execute(tmp);
    expect(result).toEqual({ backfilled: false, entriesProjected: 0 });
  });

  it('is a no-op when there are no historical entries', async () => {
    const useCase = new BackfillModuleUsageUseCase();
    const result = await useCase.execute(tmp);
    expect(result).toEqual({ backfilled: true, entriesProjected: 0 });
  });
});
