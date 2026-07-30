import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectUnderstandingWriter } from '../ProjectUnderstandingWriter';
import { ProjectUnderstandingLoader } from '../ProjectUnderstandingLoader';
import { ProjectUnderstandingPromptBuilder } from '../ProjectUnderstandingPromptBuilder';
import { PROJECT_UNDERSTANDING_DIR } from '../types';

// Real temp dirs, not a mocked fs — the whole point of this module is that a
// file survives to the next task, and a fake fs cannot prove that.
let root: string;

const writer = new ProjectUnderstandingWriter();
const loader = new ProjectUnderstandingLoader();
const promptBuilder = new ProjectUnderstandingPromptBuilder();

const baseInput = {
  markdown: '# Project Understanding — demo\n\n## Layers\n\nOne layer.',
  commit: 'abc1234',
  branch: 'main',
  filesScanned: 120,
  filesRead: 30,
  languages: ['typescript'],
  frameworks: ['react'],
};

function manifestPath(): string {
  return path.join(root, PROJECT_UNDERSTANDING_DIR, 'manifest.json');
}

function readManifest(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(manifestPath(), 'utf8')) as Record<string, unknown>;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-understanding-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('ProjectUnderstandingWriter', () => {
  it('writes both the map and its manifest', async () => {
    const { filesWritten } = await writer.write({ workspaceRoot: root, ...baseInput });

    expect(filesWritten).toHaveLength(2);
    expect(fs.existsSync(path.join(root, PROJECT_UNDERSTANDING_DIR, 'understanding.md'))).toBe(true);
    expect(readManifest()).toMatchObject({
      version: 1,
      status: 'ready',
      commit: 'abc1234',
      filesScanned: 120,
      filesRead: 30,
    });
  });

  it('leaves no .tmp files behind, so the loader never sees a torn write', async () => {
    await writer.write({ workspaceRoot: root, ...baseInput });
    const entries = fs.readdirSync(path.join(root, PROJECT_UNDERSTANDING_DIR));
    expect(entries.filter(f => f.includes('.tmp'))).toEqual([]);
  });

  it('markStale downgrades ready without touching the map itself', async () => {
    await writer.write({ workspaceRoot: root, ...baseInput });
    const before = fs.readFileSync(path.join(root, PROJECT_UNDERSTANDING_DIR, 'understanding.md'), 'utf8');

    await writer.markStale(root);

    expect(readManifest().status).toBe('stale');
    expect(fs.readFileSync(path.join(root, PROJECT_UNDERSTANDING_DIR, 'understanding.md'), 'utf8')).toBe(before);
  });

  it('markStale is a no-op when nothing has been written', async () => {
    await expect(writer.markStale(root)).resolves.toBeUndefined();
  });
});

describe('ProjectUnderstandingLoader', () => {
  it('round-trips what the writer wrote', async () => {
    await writer.write({ workspaceRoot: root, ...baseInput });

    const loaded = loader.load(root);
    expect(loaded?.markdown).toContain('## Layers');
    expect(loaded?.manifest.commit).toBe('abc1234');
    expect(loaded?.isStale).toBe(false);
  });

  it('returns undefined when nothing is persisted', () => {
    expect(loader.load(root)).toBeUndefined();
  });

  it('rejects a map written under a different schema version', async () => {
    await writer.write({ workspaceRoot: root, ...baseInput });
    const manifest = readManifest();
    manifest.schemaVersion = 'project-understanding-v0';
    fs.writeFileSync(manifestPath(), JSON.stringify(manifest), 'utf8');

    expect(loader.load(root)).toBeUndefined();
  });

  it('rejects a map that describes a different workspace', async () => {
    await writer.write({ workspaceRoot: root, ...baseInput });
    const manifest = readManifest();
    manifest.workspaceRootHash = 'not-this-workspace';
    fs.writeFileSync(manifestPath(), JSON.stringify(manifest), 'utf8');

    // Guards the copied-workspace case: serving another project's map would be
    // confidently wrong rather than merely unhelpful.
    expect(loader.load(root)).toBeUndefined();
  });

  it('returns undefined rather than throwing on a corrupt manifest', async () => {
    await writer.write({ workspaceRoot: root, ...baseInput });
    fs.writeFileSync(manifestPath(), '{ not json', 'utf8');

    expect(loader.load(root)).toBeUndefined();
  });

  it('treats an old map as stale even when the manifest still says ready', async () => {
    await writer.write({ workspaceRoot: root, ...baseInput });
    const manifest = readManifest();
    manifest.generatedAt = Date.now() - 30 * 86_400_000;
    fs.writeFileSync(manifestPath(), JSON.stringify(manifest), 'utf8');

    const loaded = loader.load(root);
    expect(loaded?.isStale).toBe(true);
    expect(loaded?.ageDays).toBeGreaterThanOrEqual(29);
  });
});

describe('ProjectUnderstandingPromptBuilder', () => {
  it('includes a staleness warning only when the map is stale', async () => {
    await writer.write({ workspaceRoot: root, ...baseInput });
    const fresh = loader.load(root)!;
    expect(promptBuilder.build(fresh)).not.toContain('<staleness_warning>');

    await writer.markStale(root);
    const stale = loader.load(root)!;
    expect(promptBuilder.build(stale)).toContain('<staleness_warning>');
  });

  it('truncates past the cap and points at the file on disk', async () => {
    await writer.write({ workspaceRoot: root, ...baseInput, markdown: 'x'.repeat(5000) });
    const loaded = loader.load(root)!;

    const out = promptBuilder.build(loaded, { maxChars: 500 });
    expect(out).toContain('map truncated at 500 chars');
    expect(out).toContain('.nexus/project-understanding/understanding.md');
    expect(out.length).toBeLessThan(1000);
  });
});
