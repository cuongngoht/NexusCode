import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PROJECT_UNDERSTANDING_DIR,
  PROJECT_UNDERSTANDING_SCHEMA_VERSION,
  type ProjectUnderstandingManifest,
} from './types';
import { hashWorkspaceRoot } from '../project-memory/ProjectMemoryStatusService';

export interface WriteUnderstandingInput {
  workspaceRoot: string;
  /** The markdown map, as authored by the model. */
  markdown: string;
  commit: string;
  branch?: string;
  filesScanned: number;
  filesRead: number;
  languages: string[];
  frameworks: string[];
}

/**
 * Persists understanding.md + manifest.json.
 *
 * Writes are tmp+rename, matching ArchitectureMemoryWriter — a torn read here
 * would be injected straight into a prompt, so a half-written map is worse than
 * a missing one. The markdown lands first so a reader that finds the manifest
 * can rely on the map already being complete.
 */
export class ProjectUnderstandingWriter {
  async write(input: WriteUnderstandingInput): Promise<{ filesWritten: string[] }> {
    const dir = path.join(input.workspaceRoot, PROJECT_UNDERSTANDING_DIR);
    await fs.mkdir(dir, { recursive: true });

    const markdown = input.markdown.trim() + '\n';

    const manifest: ProjectUnderstandingManifest = {
      version: 1,
      schemaVersion: PROJECT_UNDERSTANDING_SCHEMA_VERSION,
      status: 'ready',
      workspaceRootHash: hashWorkspaceRoot(input.workspaceRoot),
      generatedAt: Date.now(),
      commit: input.commit,
      branch: input.branch,
      filesScanned: input.filesScanned,
      filesRead: input.filesRead,
      languages: input.languages,
      frameworks: input.frameworks,
      contentChars: markdown.length,
    };

    const filesWritten: string[] = [];
    const toWrite: Array<{ name: string; content: string }> = [
      { name: 'understanding.md', content: markdown },
      { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) + '\n' },
    ];

    for (const { name, content } of toWrite) {
      const target = path.join(dir, name);
      const tmp = path.join(dir, `${name}.${process.pid}.${Date.now()}.tmp`);
      await fs.writeFile(tmp, content, 'utf8');
      await fs.rename(tmp, target);
      filesWritten.push(target);
    }

    return { filesWritten };
  }

  /**
   * Downgrades `ready` → `stale` in place, leaving the map itself untouched.
   *
   * A stale map is still useful — layer names and conventions rarely change
   * with a single commit — so it keeps being injected, just with a warning
   * attached. Deleting it on the first file change would throw away most of its
   * value for a small correctness gain.
   */
  async markStale(workspaceRoot: string): Promise<void> {
    const manifestPath = path.join(workspaceRoot, PROJECT_UNDERSTANDING_DIR, 'manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(raw) as ProjectUnderstandingManifest;
      if (manifest.status !== 'ready') return;
      manifest.status = 'stale';
      const tmp = `${manifestPath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      await fs.rename(tmp, manifestPath);
    } catch {
      // No manifest, or unreadable — nothing to downgrade.
    }
  }
}
