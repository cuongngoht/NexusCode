import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Bm25Index } from './Bm25Index';

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
