import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileIntelligenceContextSelector } from '../FileIntelligenceContextSelector';
import type { IFileIntelligenceStore } from '../FileIntelligenceStore';
import type { FileIntelligenceIgnoreFilter } from '../FileIntelligenceIgnoreFilter';
import type { FileIntelligenceProfile, FileIntelligenceIndex } from '../types';

function makeProfile(filePath: string, overrides: Partial<FileIntelligenceProfile> = {}): FileIntelligenceProfile {
  return {
    filePath,
    confidence: 0.7,
    freshness: 'fresh',
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

function makeMockStore(profiles: FileIntelligenceProfile[]): IFileIntelligenceStore {
  const profileMap = new Map(profiles.map(p => [p.filePath, p]));
  const index: FileIntelligenceIndex = {
    version: 1,
    updatedAt: Date.now(),
    profiles: profiles.map(p => ({
      filePath: p.filePath,
      freshness: p.freshness,
      confidence: p.confidence,
      updatedAt: p.updatedAt,
    })),
  };
  return {
    read: vi.fn().mockImplementation((_root: string, filePath: string) =>
      Promise.resolve(profileMap.get(filePath)),
    ),
    write: vi.fn(),
    readIndex: vi.fn().mockResolvedValue(index),
    writeIndex: vi.fn(),
    delete: vi.fn(),
    listAll: vi.fn().mockResolvedValue(profiles.map(p => p.filePath)),
  };
}

function makeMockFilter(ignoredPaths: string[] = []): FileIntelligenceIgnoreFilter {
  return {
    shouldIgnore: vi.fn().mockImplementation((p: string) => ignoredPaths.some(ig => p.includes(ig))),
    redact: vi.fn().mockImplementation((s: string) => s),
    redactProfile: vi.fn().mockImplementation((p: FileIntelligenceProfile) => p),
  } as unknown as FileIntelligenceIgnoreFilter;
}

describe('FileIntelligenceContextSelector', () => {
  it('selects files mentioned in prompt first', async () => {
    const profiles = [
      makeProfile('src/ChatController.ts', { confidence: 0.9 }),
      makeProfile('src/other.ts', { confidence: 0.5 }),
    ];
    const store = makeMockStore(profiles);
    const filter = makeMockFilter();
    const selector = new FileIntelligenceContextSelector(store, filter);

    const result = await selector.select({
      prompt: 'Look at src/ChatController.ts and fix the bug',
      workspaceRoot: '/workspace',
      mode: 'edit',
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].filePath).toBe('src/ChatController.ts');
  });

  it('respects maxProfiles budget', async () => {
    const profiles = Array.from({ length: 20 }, (_, i) =>
      makeProfile(`src/file${i}.ts`, { confidence: 0.7 }),
    );
    const store = makeMockStore(profiles);
    const filter = makeMockFilter();
    const selector = new FileIntelligenceContextSelector(store, filter);

    const result = await selector.select(
      { prompt: 'generic task', workspaceRoot: '/workspace', mode: 'edit' },
      { maxProfiles: 5 },
    );

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('excludes ignored paths', async () => {
    const profiles = [
      makeProfile('node_modules/foo/index.ts'),
      makeProfile('src/legit.ts', { confidence: 0.8 }),
    ];
    const store = makeMockStore(profiles);
    const filter = makeMockFilter(['node_modules']);
    const selector = new FileIntelligenceContextSelector(store, filter);

    const result = await selector.select({
      prompt: 'fix node_modules/foo/index.ts',
      workspaceRoot: '/workspace',
      mode: 'edit',
    });

    expect(result.every(p => !p.filePath.includes('node_modules'))).toBe(true);
  });

  it('includes recently changed files', async () => {
    const profiles = [
      makeProfile('src/recently-changed.ts', { confidence: 0.6 }),
      makeProfile('src/other.ts', { confidence: 0.9 }),
    ];
    const store = makeMockStore(profiles);
    const filter = makeMockFilter();
    const selector = new FileIntelligenceContextSelector(store, filter);

    const result = await selector.select({
      prompt: 'fix the bug',
      workspaceRoot: '/workspace',
      recentlyChangedFiles: ['src/recently-changed.ts'],
      mode: 'edit',
    });

    expect(result.some(p => p.filePath === 'src/recently-changed.ts')).toBe(true);
  });

  it('deduplicates files across priority buckets', async () => {
    const profiles = [makeProfile('src/a.ts', { confidence: 0.9 })];
    const store = makeMockStore(profiles);
    const filter = makeMockFilter();
    const selector = new FileIntelligenceContextSelector(store, filter);

    const result = await selector.select({
      prompt: 'look at src/a.ts',
      workspaceRoot: '/workspace',
      recentlyChangedFiles: ['src/a.ts'],
      mode: 'edit',
    });

    const count = result.filter(p => p.filePath === 'src/a.ts').length;
    expect(count).toBe(1);
  });
});
