import * as fs from 'fs/promises';
import * as path from 'path';
import { PROJECT_MEMORY_DIR } from '../ProjectMemoryTypes';
import type { ProjectMemorySearchIndex } from './ProjectMemoryDocument';

const SEARCH_INDEX_FILE = 'search-index.json';

function isValidIndexShape(value: unknown): value is ProjectMemorySearchIndex {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v['version'] === 1 &&
    typeof v['builtAt'] === 'number' &&
    typeof v['manifestScanId'] === 'string' &&
    Array.isArray(v['documents']) &&
    v['stats'] !== null &&
    typeof v['stats'] === 'object'
  );
}

export class FsProjectMemoryIndexRepository {
  async save(workspaceRoot: string, index: ProjectMemorySearchIndex): Promise<void> {
    const dir = path.join(workspaceRoot, PROJECT_MEMORY_DIR);
    await fs.mkdir(dir, { recursive: true });

    const target = path.join(dir, SEARCH_INDEX_FILE);
    const tmp = path.join(dir, `search-index.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(index), 'utf8');
    await fs.rename(tmp, target);
  }

  async load(workspaceRoot: string): Promise<ProjectMemorySearchIndex | undefined> {
    const filePath = path.join(workspaceRoot, PROJECT_MEMORY_DIR, SEARCH_INDEX_FILE);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return isValidIndexShape(parsed) ? parsed : undefined;
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') return undefined;
      return undefined;
    }
  }

  async delete(workspaceRoot: string): Promise<void> {
    const filePath = path.join(workspaceRoot, PROJECT_MEMORY_DIR, SEARCH_INDEX_FILE);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (!isNodeError(err) || err.code !== 'ENOENT') throw err;
    }
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
