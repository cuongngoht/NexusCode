import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Bm25Index } from './Bm25Index';
import { Bm25DocumentCache } from './Bm25DocumentCache';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm25-test-'));

  // Create project files
  fs.mkdirSync(path.join(tmpDir, 'src'));
  fs.writeFileSync(
    path.join(tmpDir, 'src', 'RunTaskHandler.ts'),
    'export class RunTaskHandler { async run() { } }'
  );
  fs.writeFileSync(
    path.join(tmpDir, 'src', 'ChatController.ts'),
    'export class ChatController { handleMessage() { } }'
  );
  fs.writeFileSync(
    path.join(tmpDir, 'src', 'types.ts'),
    'export type ProviderId = "nexus" | "claude";'
  );

  // Create excluded dirs that should NOT be indexed
  fs.mkdirSync(path.join(tmpDir, 'node_modules', 'express'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'node_modules', 'express', 'index.js'),
    'module.exports = {};'
  );
  fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'dist', 'bundle.js'),
    'var x = 1;'
  );
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Bm25Index', () => {
  it('builds index from workspace files', async () => {
    const index = await Bm25Index.build(tmpDir);
    expect(index.documentCount).toBeGreaterThan(0);
  });

  it('excludes node_modules from index', async () => {
    const index = await Bm25Index.build(tmpDir);
    const results = index.search('express module', 10);
    const paths = results.map(r => r.path);
    expect(paths.every(p => !p.includes('node_modules'))).toBe(true);
  });

  it('excludes dist from index', async () => {
    const index = await Bm25Index.build(tmpDir);
    const results = index.search('bundle', 10);
    const paths = results.map(r => r.path);
    expect(paths.every(p => !p.startsWith('dist'))).toBe(true);
  });

  it('finds RunTaskHandler when searching for runTask', async () => {
    const index = await Bm25Index.build(tmpDir);
    const results = index.search('RunTaskHandler run', 5);
    const paths = results.map(r => r.path);
    expect(paths.some(p => p.includes('RunTaskHandler'))).toBe(true);
  });

  it('searchMany merges results from multiple queries', async () => {
    const index = await Bm25Index.build(tmpDir);
    const results = index.searchMany(['RunTaskHandler', 'ChatController'], 5);
    const paths = results.map(r => r.path);
    expect(paths.some(p => p.includes('RunTaskHandler'))).toBe(true);
    expect(paths.some(p => p.includes('ChatController'))).toBe(true);
  });

  it('returns results sorted by descending score', async () => {
    const index = await Bm25Index.build(tmpDir);
    const results = index.search('ChatController handleMessage', 10);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns empty array when query matches nothing', async () => {
    const index = await Bm25Index.build(tmpDir);
    const results = index.search('zzz_nonexistent_xyz_12345', 5);
    expect(results).toHaveLength(0);
  });
});

describe('Bm25Index with document cache', () => {
  it('second build with same cache returns identical results', async () => {
    const cache = new Bm25DocumentCache();
    const first = await Bm25Index.build(tmpDir, { cache });
    const firstResults = first.search('RunTaskHandler run', 5);

    const second = await Bm25Index.build(tmpDir, { cache });
    const secondResults = second.search('RunTaskHandler run', 5);

    expect(second.documentCount).toBe(first.documentCount);
    expect(secondResults).toEqual(firstResults);
  });

  it('skips re-reading files on cache hit (same mtime and size)', async () => {
    const target = path.join(tmpDir, 'src', 'CacheHitProbe.ts');
    const fixedTime = new Date('2026-01-01T00:00:00Z');
    fs.writeFileSync(target, 'export const zangold = 1;');
    fs.utimesSync(target, fixedTime, fixedTime);

    const cache = new Bm25DocumentCache();
    await Bm25Index.build(tmpDir, { cache });

    // Rewrite with same byte length and pin the same mtime so the
    // (mtime, size) key still matches — a cache hit must skip the new content.
    fs.writeFileSync(target, 'export const zangnew = 1;');
    fs.utimesSync(target, fixedTime, fixedTime);

    const index = await Bm25Index.build(tmpDir, { cache });
    expect(index.search('zangold', 5).length).toBeGreaterThan(0);
    expect(index.search('zangnew', 5)).toHaveLength(0);

    fs.rmSync(target);
  });

  it('invalidates cache entry when file content and mtime change', async () => {
    const cache = new Bm25DocumentCache();
    await Bm25Index.build(tmpDir, { cache });

    const target = path.join(tmpDir, 'src', 'types.ts');
    fs.writeFileSync(target, 'export type ProviderId = "nexus"; // uniqueCacheProbe');
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(target, future, future);

    const index = await Bm25Index.build(tmpDir, { cache });
    const results = index.search('uniqueCacheProbe', 5);
    expect(results.some(r => r.path === 'src/types.ts')).toBe(true);
  });

  it('prunes deleted files from cache and index', async () => {
    const doomed = path.join(tmpDir, 'src', 'Doomed.ts');
    fs.writeFileSync(doomed, 'export class DoomedSentinel { }');

    const cache = new Bm25DocumentCache();
    const before = await Bm25Index.build(tmpDir, { cache });
    expect(before.search('DoomedSentinel', 5).length).toBeGreaterThan(0);
    const sizeBefore = cache.size;

    fs.rmSync(doomed);
    const after = await Bm25Index.build(tmpDir, { cache });
    expect(after.search('DoomedSentinel', 5)).toHaveLength(0);
    expect(cache.size).toBe(sizeBefore - 1);
  });
});

describe('Bm25DocumentCache', () => {
  const file = { relativePath: 'a.ts', absolutePath: '/x/a.ts', sizeBytes: 10, mtimeMs: 1000 };
  const doc = { mtimeMs: 1000, sizeBytes: 10, termFreq: new Map([['a', 1]]), docLength: 1 };

  it('hits only when both mtime and size match', () => {
    const cache = new Bm25DocumentCache();
    cache.set(file, doc);
    expect(cache.get(file)).toBe(doc);
    expect(cache.get({ ...file, mtimeMs: 2000 })).toBeUndefined();
    expect(cache.get({ ...file, sizeBytes: 11 })).toBeUndefined();
  });

  it('misses for unknown paths', () => {
    const cache = new Bm25DocumentCache();
    expect(cache.get(file)).toBeUndefined();
  });

  it('prune keeps only live paths', () => {
    const cache = new Bm25DocumentCache();
    cache.set(file, doc);
    cache.set({ ...file, absolutePath: '/x/b.ts' }, doc);
    cache.prune(new Set(['/x/b.ts']));
    expect(cache.size).toBe(1);
    expect(cache.get(file)).toBeUndefined();
  });
});
