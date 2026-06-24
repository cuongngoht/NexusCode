import * as path from 'path';
import { randomUUID } from 'crypto';
import { NexusFileTreeScanner } from '../../context/project-map/NexusFileTreeScanner';
import { NexusMarkerDetector } from '../../context/project-map/NexusMarkerDetector';
import { NexusProjectUnitDetector } from '../../context/project-map/NexusProjectUnitDetector';
import { NexusProjectMapBuilder } from '../../context/project-map/NexusProjectMapBuilder';
import { NexusProjectMapWriter } from '../../context/project-map/NexusProjectMapWriter';
import type { ProjectMapResult } from '../../context/project-map/types';
import {
  FsProjectMemoryManifestRepository,
  FsProjectMemoryIndexRepository,
  ProjectMemoryIndexBuilder,
  PROJECT_MEMORY_SCHEMA_VERSION,
  hashWorkspaceRoot,
  type ProjectMemoryManifest,
  type ProjectMemoryManifestRepository,
} from '../../context/project-memory';

export type BuildProjectMapInput = {
  workspaceRoot: string;
  maxDepth?: number;
  maxFiles?: number;
};

export type BuildProjectMapOutput = ProjectMapResult & {
  filesWritten: string[];
};

export class BuildProjectMapUseCase {
  constructor(
    private readonly scanner: NexusFileTreeScanner,
    private readonly markerDetector: NexusMarkerDetector,
    private readonly unitDetector: NexusProjectUnitDetector,
    private readonly mapBuilder: NexusProjectMapBuilder,
    private readonly writer: NexusProjectMapWriter,
    private readonly projectMemoryRepository: ProjectMemoryManifestRepository = new FsProjectMemoryManifestRepository(),
    private readonly indexBuilder: ProjectMemoryIndexBuilder = new ProjectMemoryIndexBuilder(),
    private readonly indexRepository: FsProjectMemoryIndexRepository = new FsProjectMemoryIndexRepository(),
  ) {}

  async execute(input: BuildProjectMapInput): Promise<BuildProjectMapOutput> {
    const scanId = randomUUID();
    const startedAt = Date.now();
    const workspaceRootHash = hashWorkspaceRoot(input.workspaceRoot);
    const workspaceRootName = path.basename(input.workspaceRoot);
    const createdAt = await this.readExistingCreatedAt(input.workspaceRoot, startedAt);

    await this.projectMemoryRepository.writeManifest(input.workspaceRoot, {
      version: 1,
      status: 'building',
      workspaceRootHash,
      workspaceRootName,
      schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
      scanId,
      source: 'manual_scan',
      createdAt,
      updatedAt: startedAt,
    });

    try {
      const tree = await this.scanner.scan(input.workspaceRoot, {
        maxDepth: input.maxDepth,
        maxFiles: input.maxFiles,
      });

      const markers = this.markerDetector.detect(tree);
      const units = this.unitDetector.detect(tree, markers);
      const markdown = this.mapBuilder.build({ tree, markers, units });

      const result: ProjectMapResult = {
        rootPath: input.workspaceRoot,
        generatedAt: new Date().toISOString(),
        tree,
        markers,
        units,
        markdown,
      };

      const { filesWritten } = await this.writer.write(input.workspaceRoot, result);

      const completedAt = Date.now();
      await this.projectMemoryRepository.writeManifest(input.workspaceRoot, {
        version: 1,
        status: 'ready',
        workspaceRootHash,
        workspaceRootName,
        schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
        scanId,
        source: 'manual_scan',
        createdAt,
        updatedAt: completedAt,
        lastFullScanAt: completedAt,
        filesIndexed: tree.files.length,
        modulesIndexed: units.length,
      });

      // Build BM25 search index from the scan artifacts
      try {
        const searchIndex = await this.indexBuilder.build(input.workspaceRoot, scanId);
        await this.indexRepository.save(input.workspaceRoot, searchIndex);
      } catch {
        // Non-blocking: index build failure must not fail the scan
      }

      return { ...result, filesWritten };
    } catch (error) {
      await this.writeFailedManifest({
        workspaceRoot: input.workspaceRoot,
        workspaceRootHash,
        workspaceRootName,
        scanId,
        createdAt,
        message: error instanceof Error ? error.message : String(error),
        phase: 'full_scan',
      });
      throw error;
    }
  }

  private async readExistingCreatedAt(workspaceRoot: string, fallback: number): Promise<number> {
    try {
      return (await this.projectMemoryRepository.readManifest(workspaceRoot))?.createdAt ?? fallback;
    } catch {
      return fallback;
    }
  }

  private async writeFailedManifest(input: {
    workspaceRoot: string;
    workspaceRootHash: string;
    workspaceRootName: string;
    scanId: string;
    createdAt: number;
    message: string;
    phase: string;
  }): Promise<void> {
    const now = Date.now();
    const manifest: ProjectMemoryManifest = {
      version: 1,
      status: 'failed',
      workspaceRootHash: input.workspaceRootHash,
      workspaceRootName: input.workspaceRootName,
      schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
      scanId: input.scanId,
      source: 'manual_scan',
      createdAt: input.createdAt,
      updatedAt: now,
      error: {
        message: input.message,
        at: now,
        phase: input.phase,
      },
    };
    await this.projectMemoryRepository.writeManifest(input.workspaceRoot, manifest);
  }
}
