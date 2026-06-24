import * as crypto from 'crypto';
import * as path from 'path';
import {
  PROJECT_MEMORY_SCHEMA_VERSION,
  type ProjectMemoryManifest,
  type ProjectMemoryStatus,
} from './ProjectMemoryTypes';
import {
  FsProjectMemoryManifestRepository,
  type ProjectMemoryManifestRepository,
} from './ProjectMemoryManifestRepository';

export interface ProjectMemoryStatusResult {
  status: ProjectMemoryStatus;
  manifest?: ProjectMemoryManifest;
  reason?: string;
  canUseMemory: boolean;
  canRunIncrementalUpdate: boolean;
  requiresExplicitFullScan: boolean;
}

export class ProjectMemoryStatusService {
  constructor(
    private readonly repository: ProjectMemoryManifestRepository = new FsProjectMemoryManifestRepository(),
  ) {}

  async getStatus(workspaceRoot: string): Promise<ProjectMemoryStatusResult> {
    let manifest: ProjectMemoryManifest | undefined;
    try {
      manifest = await this.repository.readManifest(workspaceRoot);
    } catch (error) {
      return {
        status: 'failed',
        reason: `Unable to read Project Memory manifest: ${error instanceof Error ? error.message : String(error)}`,
        canUseMemory: false,
        canRunIncrementalUpdate: false,
        requiresExplicitFullScan: true,
      };
    }

    if (!manifest) {
      return {
        status: 'missing',
        reason: 'Project Memory manifest does not exist.',
        canUseMemory: false,
        canRunIncrementalUpdate: false,
        requiresExplicitFullScan: true,
      };
    }

    if (manifest.schemaVersion !== PROJECT_MEMORY_SCHEMA_VERSION) {
      return {
        status: 'needs_rebuild',
        manifest,
        reason: `Project Memory schema ${manifest.schemaVersion} does not match ${PROJECT_MEMORY_SCHEMA_VERSION}.`,
        canUseMemory: false,
        canRunIncrementalUpdate: false,
        requiresExplicitFullScan: true,
      };
    }

    const currentWorkspaceRootHash = hashWorkspaceRoot(workspaceRoot);
    if (manifest.workspaceRootHash !== currentWorkspaceRootHash) {
      return {
        status: 'needs_rebuild',
        manifest,
        reason: 'Project Memory was generated for a different workspace root.',
        canUseMemory: false,
        canRunIncrementalUpdate: false,
        requiresExplicitFullScan: true,
      };
    }

    switch (manifest.status) {
      case 'ready':
        return {
          status: 'ready',
          manifest,
          canUseMemory: true,
          canRunIncrementalUpdate: true,
          requiresExplicitFullScan: false,
        };
      case 'stale':
        return {
          status: 'stale',
          manifest,
          reason: 'Project Memory is stale.',
          canUseMemory: true,
          canRunIncrementalUpdate: true,
          requiresExplicitFullScan: false,
        };
      case 'building':
        return {
          status: 'building',
          manifest,
          reason: 'Project Memory is currently building.',
          canUseMemory: false,
          canRunIncrementalUpdate: false,
          requiresExplicitFullScan: false,
        };
      case 'failed':
        return {
          status: 'failed',
          manifest,
          reason: manifest.error?.message ?? 'Project Memory build failed.',
          canUseMemory: false,
          canRunIncrementalUpdate: false,
          requiresExplicitFullScan: true,
        };
      case 'needs_rebuild':
        return {
          status: 'needs_rebuild',
          manifest,
          reason: 'Project Memory requires a full rebuild.',
          canUseMemory: false,
          canRunIncrementalUpdate: false,
          requiresExplicitFullScan: true,
        };
      case 'missing':
        return {
          status: 'missing',
          manifest,
          reason: 'Project Memory manifest is marked missing.',
          canUseMemory: false,
          canRunIncrementalUpdate: false,
          requiresExplicitFullScan: true,
        };
    }
  }
}

export function hashWorkspaceRoot(workspaceRoot: string): string {
  const normalized = path.resolve(workspaceRoot);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
