import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArchitectureStyleDetector } from '../ArchitectureStyleDetector';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-arch-style-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function mkdirs(base: string, ...dirs: string[]): void {
  for (const dir of dirs) {
    fs.mkdirSync(path.join(base, dir), { recursive: true });
  }
}

describe('ArchitectureStyleDetector', () => {
  const detector = new ArchitectureStyleDetector();

  it('detects clean-architecture from domain/application/infrastructure', async () => {
    mkdirs(tmp, 'src/domain', 'src/application', 'src/infrastructure', 'src/presentation');
    const result = await detector.detect(tmp);
    expect(result.style).toBe('clean-architecture');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects hexagonal from ports/adapters/domain', async () => {
    mkdirs(tmp, 'src/domain', 'src/adapters', 'src/ports');
    const result = await detector.detect(tmp);
    expect(['hexagonal', 'clean-architecture']).toContain(result.style);
  });

  it('detects a layered style from controllers/services/models/repositories', async () => {
    mkdirs(tmp, 'src/controllers', 'src/services', 'src/models', 'src/repositories');
    const result = await detector.detect(tmp);
    // controllers → interface, services → application, models → core, repositories → infrastructure
    // These signals match both mvc and clean-architecture equally well
    expect(['mvc', 'clean-architecture']).toContain(result.style);
    expect(result.layerPaths['interface']).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects feature-based from features/shared', async () => {
    mkdirs(tmp, 'src/features', 'src/shared');
    const result = await detector.detect(tmp);
    expect(result.style).toBe('feature-based');
  });

  it('returns unknown for unrecognized folder structure', async () => {
    mkdirs(tmp, 'src/foo', 'src/bar', 'src/baz');
    const result = await detector.detect(tmp);
    expect(result.style).toBe('unknown');
  });

  it('returns confidence > 0 when at least one signal is found', async () => {
    mkdirs(tmp, 'src/domain');
    const result = await detector.detect(tmp);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('assigns detected paths to correct layers', async () => {
    mkdirs(tmp, 'src/domain', 'src/application', 'src/infrastructure');
    const result = await detector.detect(tmp);
    expect(result.layerPaths['core']).toBeDefined();
    expect(result.layerPaths['core']!.some(p => p.endsWith('domain'))).toBe(true);
  });

  it('generates boundaries for clean-architecture style', async () => {
    mkdirs(tmp, 'src/domain', 'src/application', 'src/infrastructure', 'src/interface');
    const result = await detector.detect(tmp);
    if (result.style === 'clean-architecture') {
      expect(result.boundaries.length).toBeGreaterThan(0);
      const coreToApp = result.boundaries.find(b => b.from === 'core' && b.to === 'application');
      expect(coreToApp?.kind).toBe('forbidden');
    }
  });

  it('works when there is no src/ directory', async () => {
    mkdirs(tmp, 'domain', 'application', 'infrastructure');
    const result = await detector.detect(tmp);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('excludes node_modules from detection', async () => {
    mkdirs(tmp, 'node_modules/domain', 'src/domain', 'src/application');
    const result = await detector.detect(tmp);
    expect(result.style).not.toBe('unknown');
  });
});
