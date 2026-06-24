import * as fs from 'fs/promises';
import * as path from 'path';
import type { IFileIntelligenceStore } from './FileIntelligenceStore';
import type { FileIntelligenceProfile, FileIntelligenceIndex } from './types';
import { FILE_INTELLIGENCE_DIR } from './types';

export class JsonFileIntelligenceStore implements IFileIntelligenceStore {
  safeFilename(filePath: string): string {
    return filePath.replace(/[/\\]/g, '__') + '.json';
  }

  private profilePath(workspaceRoot: string, filePath: string): string {
    return path.join(workspaceRoot, FILE_INTELLIGENCE_DIR, this.safeFilename(filePath));
  }

  private indexPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, FILE_INTELLIGENCE_DIR, 'index.json');
  }

  private dir(workspaceRoot: string): string {
    return path.join(workspaceRoot, FILE_INTELLIGENCE_DIR);
  }

  async read(workspaceRoot: string, filePath: string): Promise<FileIntelligenceProfile | undefined> {
    try {
      const content = await fs.readFile(this.profilePath(workspaceRoot, filePath), 'utf8');
      const parsed: unknown = JSON.parse(content);
      return isValidProfileShape(parsed) ? parsed : undefined;
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') return undefined;
      return undefined;
    }
  }

  async write(workspaceRoot: string, profile: FileIntelligenceProfile): Promise<void> {
    const dir = this.dir(workspaceRoot);
    await fs.mkdir(dir, { recursive: true });

    const target = this.profilePath(workspaceRoot, profile.filePath);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(profile, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);
  }

  async readIndex(workspaceRoot: string): Promise<FileIntelligenceIndex | undefined> {
    try {
      const content = await fs.readFile(this.indexPath(workspaceRoot), 'utf8');
      const parsed: unknown = JSON.parse(content);
      return isValidIndexShape(parsed) ? parsed : undefined;
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') return undefined;
      return undefined;
    }
  }

  async writeIndex(workspaceRoot: string, index: FileIntelligenceIndex): Promise<void> {
    const dir = this.dir(workspaceRoot);
    await fs.mkdir(dir, { recursive: true });

    const target = this.indexPath(workspaceRoot);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(index, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);
  }

  async delete(workspaceRoot: string, filePath: string): Promise<void> {
    try {
      await fs.unlink(this.profilePath(workspaceRoot, filePath));
    } catch (err) {
      if (!isNodeError(err) || err.code !== 'ENOENT') throw err;
    }
  }

  async listAll(workspaceRoot: string): Promise<string[]> {
    const index = await this.readIndex(workspaceRoot);
    if (index) return index.profiles.map(p => p.filePath);

    // Fallback: scan directory
    try {
      const entries = await fs.readdir(this.dir(workspaceRoot));
      return entries
        .filter(e => e.endsWith('.json') && e !== 'index.json')
        .map(e => e.slice(0, -5).replace(/__/g, '/'));
    } catch {
      return [];
    }
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function isValidProfileShape(v: unknown): v is FileIntelligenceProfile {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m['filePath'] === 'string' &&
    typeof m['confidence'] === 'number' &&
    typeof m['freshness'] === 'string' &&
    typeof m['createdAt'] === 'number' &&
    typeof m['updatedAt'] === 'number'
  );
}

function isValidIndexShape(v: unknown): v is FileIntelligenceIndex {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return m['version'] === 1 && Array.isArray(m['profiles']);
}
