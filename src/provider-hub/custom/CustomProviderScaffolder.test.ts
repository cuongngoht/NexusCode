// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CustomProviderScaffolder } from './CustomProviderScaffolder';

describe('CustomProviderScaffolder', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates provider.json at expected path', async () => {
    const scaffolder = new CustomProviderScaffolder();
    const filePath = await scaffolder.scaffold('my-tool', tmpDir);

    const expectedPath = path.join(tmpDir, '.nexus', 'providers', 'my-tool', 'provider.json');
    expect(filePath).toBe(expectedPath);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('creates the directory hierarchy', async () => {
    const scaffolder = new CustomProviderScaffolder();
    await scaffolder.scaffold('my-tool', tmpDir);

    const dir = path.join(tmpDir, '.nexus', 'providers', 'my-tool');
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('creates valid JSON with correct id and command', async () => {
    const scaffolder = new CustomProviderScaffolder();
    const filePath = await scaffolder.scaffold('my-tool', tmpDir);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    expect(content['id']).toBe('my-tool');
    expect(content['command']).toBe('my-tool');
    expect(content['displayName']).toBe('my-tool');
  });

  it('creates valid JSON with correct models', async () => {
    const scaffolder = new CustomProviderScaffolder();
    const filePath = await scaffolder.scaffold('my-tool', tmpDir);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { models: Array<{ id: string; label: string }> };
    expect(content.models).toEqual([{ id: 'default', label: 'Default' }]);
    expect(content.models[0]).toMatchObject({ id: 'default', label: 'Default' });
  });

  it('creates valid JSON with capabilities block', async () => {
    const scaffolder = new CustomProviderScaffolder();
    const filePath = await scaffolder.scaffold('my-tool', tmpDir);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
      capabilities: Record<string, boolean>;
    };
    expect(content.capabilities).toBeDefined();
    expect(content.capabilities['canEditFiles']).toBe(false);
    expect(content.capabilities['supportsStreaming']).toBe(false);
  });

  it('throws if provider already exists', async () => {
    const scaffolder = new CustomProviderScaffolder();
    await scaffolder.scaffold('my-tool', tmpDir);
    await expect(scaffolder.scaffold('my-tool', tmpDir)).rejects.toThrow();
  });

  it('throws with a descriptive message when provider exists', async () => {
    const scaffolder = new CustomProviderScaffolder();
    await scaffolder.scaffold('my-tool', tmpDir);
    await expect(scaffolder.scaffold('my-tool', tmpDir)).rejects.toThrow(/already exists/);
  });

  it('allows scaffolding different providers in the same workspace', async () => {
    const scaffolder = new CustomProviderScaffolder();
    const path1 = await scaffolder.scaffold('tool-a', tmpDir);
    const path2 = await scaffolder.scaffold('tool-b', tmpDir);

    expect(fs.existsSync(path1)).toBe(true);
    expect(fs.existsSync(path2)).toBe(true);
  });
});
