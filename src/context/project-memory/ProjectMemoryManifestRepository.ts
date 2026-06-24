import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PROJECT_MEMORY_DIR,
  PROJECT_MEMORY_MANIFEST,
  type ProjectMemoryManifest,
} from './ProjectMemoryTypes';

export interface ProjectMemoryManifestRepository {
  readManifest(workspaceRoot: string): Promise<ProjectMemoryManifest | undefined>;
  writeManifest(workspaceRoot: string, manifest: ProjectMemoryManifest): Promise<void>;
  deleteManifest(workspaceRoot: string): Promise<void>;
  markAsStale(workspaceRoot: string): Promise<void>;
}

export class FsProjectMemoryManifestRepository implements ProjectMemoryManifestRepository {
  async readManifest(workspaceRoot: string): Promise<ProjectMemoryManifest | undefined> {
    try {
      const content = await fs.readFile(this.manifestPath(workspaceRoot), 'utf8');
      const parsed: unknown = JSON.parse(content);
      if (!isValidManifestShape(parsed)) {
        return undefined;
      }
      return parsed;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  async writeManifest(workspaceRoot: string, manifest: ProjectMemoryManifest): Promise<void> {
    const memoryDir = path.join(workspaceRoot, PROJECT_MEMORY_DIR);
    await fs.mkdir(memoryDir, { recursive: true });

    const target = this.manifestPath(workspaceRoot);
    const tmp = path.join(memoryDir, `manifest.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);
  }

  async deleteManifest(workspaceRoot: string): Promise<void> {
    try {
      await fs.unlink(this.manifestPath(workspaceRoot));
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async markAsStale(workspaceRoot: string): Promise<void> {
    const current = await this.readManifest(workspaceRoot);
    if (!current || current.status !== 'ready') return;
    await this.writeManifest(workspaceRoot, { ...current, status: 'stale', updatedAt: Date.now() });
  }

  private manifestPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, PROJECT_MEMORY_MANIFEST);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isValidManifestShape(value: unknown): value is ProjectMemoryManifest {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    m['version'] === 1 &&
    typeof m['status'] === 'string' &&
    typeof m['workspaceRootHash'] === 'string' &&
    typeof m['schemaVersion'] === 'string'
  );
}
