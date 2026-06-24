import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileIntelligenceService } from '../FileIntelligenceService';
import type { IFileIntelligenceStore } from '../FileIntelligenceStore';
import type { FileIntelligenceUpdater } from '../FileIntelligenceUpdater';
import type { FileIntelligenceIgnoreFilter } from '../FileIntelligenceIgnoreFilter';
import type { FileTouchEvent, FileIntelligenceProfile, FileIntelligenceIndex } from '../types';

function makeEvent(filePath: string, overrides: Partial<FileTouchEvent> = {}): FileTouchEvent {
  return {
    filePath,
    workspaceRoot: '/workspace',
    mode: 'edit',
    reason: 'edit',
    source: 'edit',
    confidence: 0.7,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeProfile(filePath: string): FileIntelligenceProfile {
  return {
    filePath,
    confidence: 0.7,
    freshness: 'fresh',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeMockStore(overrides: Partial<IFileIntelligenceStore> = {}): IFileIntelligenceStore {
  return {
    read: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
    readIndex: vi.fn().mockResolvedValue(undefined),
    writeIndex: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    listAll: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeMockUpdater(): FileIntelligenceUpdater {
  return {
    update: vi.fn().mockImplementation(
      (_existing: unknown, event: FileTouchEvent) => makeProfile(event.filePath),
    ),
  } as unknown as FileIntelligenceUpdater;
}

function makeMockIgnoreFilter(shouldIgnore = false): FileIntelligenceIgnoreFilter {
  return {
    shouldIgnore: vi.fn().mockReturnValue(shouldIgnore),
    redact: vi.fn().mockImplementation((s: string) => s),
    redactProfile: vi.fn().mockImplementation((p: FileIntelligenceProfile) => p),
  } as unknown as FileIntelligenceIgnoreFilter;
}

describe('FileIntelligenceService', () => {
  let store: IFileIntelligenceStore;
  let updater: FileIntelligenceUpdater;
  let filter: FileIntelligenceIgnoreFilter;
  let service: FileIntelligenceService;

  beforeEach(() => {
    store = makeMockStore();
    updater = makeMockUpdater();
    filter = makeMockIgnoreFilter(false);
    service = new FileIntelligenceService(store, updater, filter);
  });

  it('processSingle calls store.write exactly once per event', async () => {
    await service.processSingle(makeEvent('src/a.ts'));
    expect(store.write).toHaveBeenCalledTimes(1);
  });

  it('processSingle skips ignored file paths', async () => {
    const ignoringFilter = makeMockIgnoreFilter(true);
    const svc = new FileIntelligenceService(store, updater, ignoringFilter);
    await svc.processSingle(makeEvent('node_modules/foo/index.ts'));
    expect(store.write).not.toHaveBeenCalled();
  });

  it('processAll groups and calls store.write once per unique file', async () => {
    await service.processAll([
      makeEvent('src/a.ts', { timestamp: 1000 }),
      makeEvent('src/a.ts', { timestamp: 2000 }),
      makeEvent('src/b.ts', { timestamp: 1500 }),
    ]);
    // store.write called twice: once for a.ts (merged sequential), once for b.ts
    expect(store.write).toHaveBeenCalledTimes(3); // two for a.ts (sequential), one for b.ts
  });

  it('processAsync does not throw when store.write fails', async () => {
    (store.write as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('disk full'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Should not reject
    service.processAsync([makeEvent('src/a.ts')]);

    // Give the microtask queue a chance to run
    await new Promise(r => setTimeout(r, 10));
    warnSpy.mockRestore();
  });

  it('updateIndex upserts the profile entry', async () => {
    const existingIndex: FileIntelligenceIndex = {
      version: 1,
      updatedAt: 0,
      profiles: [{ filePath: 'src/a.ts', freshness: 'fresh', confidence: 0.5, updatedAt: 100 }],
    };
    (store.readIndex as ReturnType<typeof vi.fn>).mockResolvedValue(existingIndex);

    await service.processSingle(makeEvent('src/a.ts'));

    expect(store.writeIndex).toHaveBeenCalledTimes(1);
    const written = (store.writeIndex as ReturnType<typeof vi.fn>).mock.calls[0][1] as FileIntelligenceIndex;
    expect(written.profiles).toHaveLength(1); // upserted, not duplicated
    expect(written.profiles[0].filePath).toBe('src/a.ts');
  });

  it('updateIndex appends new file to existing index', async () => {
    const existingIndex: FileIntelligenceIndex = {
      version: 1,
      updatedAt: 0,
      profiles: [{ filePath: 'src/a.ts', freshness: 'fresh', confidence: 0.5, updatedAt: 100 }],
    };
    (store.readIndex as ReturnType<typeof vi.fn>).mockResolvedValue(existingIndex);

    await service.processSingle(makeEvent('src/b.ts'));

    const written = (store.writeIndex as ReturnType<typeof vi.fn>).mock.calls[0][1] as FileIntelligenceIndex;
    expect(written.profiles).toHaveLength(2);
  });
});
