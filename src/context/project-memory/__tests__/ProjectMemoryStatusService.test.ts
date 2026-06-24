import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BuildProjectMapUseCase,
} from '../../../application/usecases/BuildProjectMapUseCase';
import {
  FsProjectMemoryManifestRepository,
  PROJECT_MEMORY_SCHEMA_VERSION,
  ProjectMemoryStatusService,
  hashWorkspaceRoot,
  type ProjectMemoryManifest,
  type ProjectMemoryManifestRepository,
} from '../index';
import { NexusFileTreeScanner } from '../../project-map/NexusFileTreeScanner';
import { NexusMarkerDetector } from '../../project-map/NexusMarkerDetector';
import { NexusProjectMapBuilder } from '../../project-map/NexusProjectMapBuilder';
import { NexusProjectMapWriter } from '../../project-map/NexusProjectMapWriter';
import { NexusProjectUnitDetector } from '../../project-map/NexusProjectUnitDetector';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-project-memory-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function manifest(status: ProjectMemoryManifest['status']): ProjectMemoryManifest {
  return {
    version: 1,
    status,
    workspaceRootHash: hashWorkspaceRoot(tmp),
    workspaceRootName: path.basename(tmp),
    schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

describe('ProjectMemoryStatusService', () => {
  it('returns missing when no manifest exists', async () => {
    const service = new ProjectMemoryStatusService(new FsProjectMemoryManifestRepository());

    const result = await service.getStatus(tmp);

    expect(result.status).toBe('missing');
    expect(result.canUseMemory).toBe(false);
    expect(result.requiresExplicitFullScan).toBe(true);
  });

  it('returns ready for a ready manifest', async () => {
    const repo = new FsProjectMemoryManifestRepository();
    await repo.writeManifest(tmp, manifest('ready'));
    const service = new ProjectMemoryStatusService(repo);

    const result = await service.getStatus(tmp);

    expect(result.status).toBe('ready');
    expect(result.canUseMemory).toBe(true);
    expect(result.canRunIncrementalUpdate).toBe(true);
  });

  it('returns needs_rebuild for a schema mismatch', async () => {
    const repo = new FsProjectMemoryManifestRepository();
    await repo.writeManifest(tmp, {
      ...manifest('ready'),
      schemaVersion: 'old-schema',
    });
    const service = new ProjectMemoryStatusService(repo);

    const result = await service.getStatus(tmp);

    expect(result.status).toBe('needs_rebuild');
    expect(result.canUseMemory).toBe(false);
    expect(result.requiresExplicitFullScan).toBe(true);
  });

  it('returns needs_rebuild for a workspace hash mismatch', async () => {
    const repo = new FsProjectMemoryManifestRepository();
    await repo.writeManifest(tmp, {
      ...manifest('ready'),
      workspaceRootHash: 'wrong-hash-that-will-never-match',
    });
    const service = new ProjectMemoryStatusService(repo);

    const result = await service.getStatus(tmp);

    expect(result.status).toBe('needs_rebuild');
    expect(result.canUseMemory).toBe(false);
    expect(result.requiresExplicitFullScan).toBe(true);
  });

  it('returns failed for a failed manifest', async () => {
    const repo = new FsProjectMemoryManifestRepository();
    await repo.writeManifest(tmp, {
      ...manifest('failed'),
      error: { message: 'scan failed', at: 2000, phase: 'scan' },
    });
    const service = new ProjectMemoryStatusService(repo);

    const result = await service.getStatus(tmp);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('scan failed');
    expect(result.canUseMemory).toBe(false);
  });

  it('returns building for a building manifest', async () => {
    const repo = new FsProjectMemoryManifestRepository();
    await repo.writeManifest(tmp, manifest('building'));
    const service = new ProjectMemoryStatusService(repo);

    const result = await service.getStatus(tmp);

    expect(result.status).toBe('building');
    expect(result.canUseMemory).toBe(false);
  });

  it('returns missing for a corrupt manifest (valid JSON but invalid shape)', async () => {
    const memDir = path.join(tmp, '.nexus', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'manifest.json'), JSON.stringify({ garbage: true }), 'utf8');
    const service = new ProjectMemoryStatusService(new FsProjectMemoryManifestRepository());

    const result = await service.getStatus(tmp);

    expect(result.status).toBe('missing');
    expect(result.canUseMemory).toBe(false);
  });

  it('returns missing for a manifest with empty JSON object', async () => {
    const memDir = path.join(tmp, '.nexus', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'manifest.json'), '{}', 'utf8');
    const service = new ProjectMemoryStatusService(new FsProjectMemoryManifestRepository());

    const result = await service.getStatus(tmp);

    expect(result.status).toBe('missing');
  });

  it('never triggers project scanning', async () => {
    let readCount = 0;
    const repo: ProjectMemoryManifestRepository = {
      async readManifest() {
        readCount += 1;
        return undefined;
      },
      async writeManifest() {
        throw new Error('status service must not write manifests');
      },
      async deleteManifest() {
        throw new Error('status service must not delete manifests');
      },
    };
    const service = new ProjectMemoryStatusService(repo);

    const result = await service.getStatus(tmp);

    expect(readCount).toBe(1);
    expect(result.status).toBe('missing');
  });
});

describe('BuildProjectMapUseCase Project Memory manifest integration', () => {
  it('writes a ready manifest after an explicit project map build', async () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.writeFileSync(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n', 'utf8');
    const repo = new FsProjectMemoryManifestRepository();
    const useCase = new BuildProjectMapUseCase(
      new NexusFileTreeScanner(),
      new NexusMarkerDetector(),
      new NexusProjectUnitDetector(),
      new NexusProjectMapBuilder(),
      new NexusProjectMapWriter(),
      repo,
    );

    await useCase.execute({ workspaceRoot: tmp, maxDepth: 4, maxFiles: 50 });
    const status = await new ProjectMemoryStatusService(repo).getStatus(tmp);

    expect(status.status).toBe('ready');
    expect(status.manifest?.source).toBe('manual_scan');
    expect(status.manifest?.filesIndexed).toBeGreaterThan(0);
    expect(status.manifest?.lastFullScanAt).toBeTypeOf('number');
  });

  it('writes a failed manifest when an explicit project map build fails', async () => {
    const repo = new FsProjectMemoryManifestRepository();
    const failingScanner = {
      async scan(): Promise<never> {
        throw new Error('scan exploded');
      },
    };
    const useCase = new BuildProjectMapUseCase(
      failingScanner as unknown as NexusFileTreeScanner,
      new NexusMarkerDetector(),
      new NexusProjectUnitDetector(),
      new NexusProjectMapBuilder(),
      new NexusProjectMapWriter(),
      repo,
    );

    await expect(useCase.execute({ workspaceRoot: tmp })).rejects.toThrow('scan exploded');
    const status = await new ProjectMemoryStatusService(repo).getStatus(tmp);

    expect(status.status).toBe('failed');
    expect(status.manifest?.error?.message).toBe('scan exploded');
    expect(status.canUseMemory).toBe(false);
  });
});
