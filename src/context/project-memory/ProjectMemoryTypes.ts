export type ProjectMemoryStatus =
  | 'missing'
  | 'ready'
  | 'stale'
  | 'building'
  | 'failed'
  | 'needs_rebuild';

export interface ProjectMemoryManifest {
  version: 1;
  status: ProjectMemoryStatus;

  workspaceRootHash: string;
  workspaceRootName?: string;

  schemaVersion: string;
  scanId?: string;

  createdAt?: number;
  updatedAt?: number;
  lastFullScanAt?: number;
  lastIncrementalScanAt?: number;

  source?: 'manual_scan' | 'manual_rebuild' | 'imported';

  filesIndexed?: number;
  symbolsIndexed?: number;
  modulesIndexed?: number;

  error?: {
    message: string;
    at: number;
    phase?: string;
  };
}

export const PROJECT_MEMORY_SCHEMA_VERSION = 'project-memory-v1';
export const PROJECT_MEMORY_DIR = '.nexus/memory';
export const PROJECT_MEMORY_MANIFEST = '.nexus/memory/manifest.json';
