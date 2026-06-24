import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { JsonFileIntelligenceStore } from '../JsonFileIntelligenceStore';
import type { FileIntelligenceProfile } from '../types';

function makeProfile(overrides: Partial<FileIntelligenceProfile> = {}): FileIntelligenceProfile {
  return {
    filePath: 'src/foo.ts',
    confidence: 0.7,
    freshness: 'fresh',
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

describe('JsonFileIntelligenceStore', () => {
  const store = new JsonFileIntelligenceStore();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fi-store-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('safeFilename converts forward slashes to double underscores', () => {
    expect(store.safeFilename('src/foo/Bar.ts')).toBe('src__foo__Bar.ts.json');
  });

  it('safeFilename converts backslashes too', () => {
    expect(store.safeFilename('src\\foo\\Bar.ts')).toBe('src__foo__Bar.ts.json');
  });

  it('write and read round-trips a profile', async () => {
    const profile = makeProfile({ filePath: 'src/foo.ts', summary: 'Test file' });
    await store.write(tmpDir, profile);
    const read = await store.read(tmpDir, 'src/foo.ts');
    expect(read).toEqual(profile);
  });

  it('read returns undefined for missing file', async () => {
    const result = await store.read(tmpDir, 'src/nonexistent.ts');
    expect(result).toBeUndefined();
  });

  it('read returns undefined for malformed JSON', async () => {
    const dir = path.join(tmpDir, '.nexus', 'file-intelligence');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, store.safeFilename('src/bad.ts')), 'not json!');
    const result = await store.read(tmpDir, 'src/bad.ts');
    expect(result).toBeUndefined();
  });

  it('read returns undefined for JSON missing required fields', async () => {
    const dir = path.join(tmpDir, '.nexus', 'file-intelligence');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, store.safeFilename('src/bad.ts')), JSON.stringify({ foo: 'bar' }));
    const result = await store.read(tmpDir, 'src/bad.ts');
    expect(result).toBeUndefined();
  });

  it('listAll returns profiled file paths after writes', async () => {
    await store.write(tmpDir, makeProfile({ filePath: 'src/a.ts' }));
    await store.write(tmpDir, makeProfile({ filePath: 'src/b.ts' }));
    // Write index manually via the store write (index is auto-updated via service, not store directly)
    // Since store.listAll falls back to filesystem scan, it should still work
    const all = await store.listAll(tmpDir);
    // Fallback scans files and converts __ back to / — verify the converted paths
    expect(all).toContain('src/a.ts');
    expect(all).toContain('src/b.ts');
  });

  it('index write and read round-trips', async () => {
    const index = {
      version: 1 as const,
      updatedAt: 5000,
      profiles: [{ filePath: 'src/a.ts', freshness: 'fresh' as const, confidence: 0.8, updatedAt: 4000 }],
    };
    await store.writeIndex(tmpDir, index);
    const read = await store.readIndex(tmpDir);
    expect(read).toEqual(index);
  });

  it('listAll uses index when available', async () => {
    const index = {
      version: 1 as const,
      updatedAt: 5000,
      profiles: [
        { filePath: 'src/a.ts', freshness: 'fresh' as const, confidence: 0.8, updatedAt: 4000 },
        { filePath: 'src/b.ts', freshness: 'fresh' as const, confidence: 0.7, updatedAt: 3000 },
      ],
    };
    await store.writeIndex(tmpDir, index);
    const all = await store.listAll(tmpDir);
    expect(all).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('delete removes the profile file', async () => {
    await store.write(tmpDir, makeProfile({ filePath: 'src/delete-me.ts' }));
    await store.delete(tmpDir, 'src/delete-me.ts');
    const result = await store.read(tmpDir, 'src/delete-me.ts');
    expect(result).toBeUndefined();
  });

  it('delete is idempotent for nonexistent file', async () => {
    await expect(store.delete(tmpDir, 'src/ghost.ts')).resolves.not.toThrow();
  });
});
