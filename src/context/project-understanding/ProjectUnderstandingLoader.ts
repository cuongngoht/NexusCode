import * as fs from 'fs';
import * as path from 'path';
import {
  PROJECT_UNDERSTANDING_DIR,
  PROJECT_UNDERSTANDING_SCHEMA_VERSION,
  type ProjectUnderstandingManifest,
} from './types';
import { hashWorkspaceRoot } from '../project-memory/ProjectMemoryStatusService';

export interface LoadedProjectUnderstanding {
  markdown: string;
  manifest: ProjectUnderstandingManifest;
  /** Days since the map was generated, for staleness messaging. */
  ageDays: number;
  /** True when the manifest says stale, or the map is old enough to distrust. */
  isStale: boolean;
}

/** Beyond this, a map is treated as suspect even if no file watcher fired. */
const ANCIENT_AFTER_DAYS = 14;

function isValidManifestShape(value: unknown): value is ProjectUnderstandingManifest {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<ProjectUnderstandingManifest>;
  return (
    m.version === 1 &&
    typeof m.schemaVersion === 'string' &&
    typeof m.workspaceRootHash === 'string' &&
    typeof m.generatedAt === 'number' &&
    typeof m.commit === 'string'
  );
}

/**
 * Reads the persisted understanding, or returns undefined for any reason at all.
 *
 * Synchronous and defensive by design: this runs inside a pipeline pre-step on
 * the hot path of every task, and a missing or malformed map must degrade to
 * "no extra context" rather than failing the user's request.
 */
export class ProjectUnderstandingLoader {
  load(workspaceRoot: string): LoadedProjectUnderstanding | undefined {
    try {
      const dir = path.join(workspaceRoot, PROJECT_UNDERSTANDING_DIR);
      const manifestPath = path.join(dir, 'manifest.json');
      const markdownPath = path.join(dir, 'understanding.md');

      if (!fs.existsSync(manifestPath) || !fs.existsSync(markdownPath)) return undefined;

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
      if (!isValidManifestShape(manifest)) return undefined;

      // Schema drift: a map written by an older layout may not mean what this
      // code thinks it means. Refuse rather than mis-inject.
      if (manifest.schemaVersion !== PROJECT_UNDERSTANDING_SCHEMA_VERSION) return undefined;

      // Workspace moved or was copied — the map describes a different checkout.
      if (manifest.workspaceRootHash !== hashWorkspaceRoot(workspaceRoot)) return undefined;

      if (manifest.status === 'failed') return undefined;

      const markdown = fs.readFileSync(markdownPath, 'utf8').trim();
      if (!markdown) return undefined;

      const ageDays = Math.max(0, Math.floor((Date.now() - manifest.generatedAt) / 86_400_000));

      return {
        markdown,
        manifest,
        ageDays,
        isStale: manifest.status === 'stale' || ageDays >= ANCIENT_AFTER_DAYS,
      };
    } catch {
      return undefined;
    }
  }
}
