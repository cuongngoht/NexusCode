/**
 * Project understanding — the durable, LLM-authored map of a codebase.
 *
 * Distinct from the neighbouring `.nexus/` artifacts in one important way: this
 * one is *written by the model*, not derived deterministically. `project-map`
 * and `architecture-memory` are computed from the tree and the import graph;
 * this is the synthesis a human would write after reading the project — layers
 * in the project's own vocabulary, a traced request path, the gotchas.
 *
 * That makes it the artifact worth injecting into later prompts: it carries the
 * judgement the deterministic scans cannot produce.
 */

export const PROJECT_UNDERSTANDING_SCHEMA_VERSION = 'project-understanding-v1';
export const PROJECT_UNDERSTANDING_DIR = '.nexus/project-understanding';
export const PROJECT_UNDERSTANDING_FILES = {
  understandingMd: `${PROJECT_UNDERSTANDING_DIR}/understanding.md`,
  manifestJson: `${PROJECT_UNDERSTANDING_DIR}/manifest.json`,
} as const;

export type ProjectUnderstandingStatus = 'ready' | 'stale' | 'failed';

export interface ProjectUnderstandingManifest {
  version: 1;
  schemaVersion: string;
  status: ProjectUnderstandingStatus;

  /**
   * sha256 of the resolved workspace root, so a moved or copied workspace
   * invalidates rather than silently serving another project's map. Same
   * derivation as the project-memory manifest (`hashWorkspaceRoot`).
   */
  workspaceRootHash: string;

  /** Epoch ms, matching every other manifest in `.nexus/`. */
  generatedAt: number;

  /** Short git hash the map describes, or `no-git`. */
  commit: string;
  branch?: string;

  /** How many files the structural pass saw. */
  filesScanned: number;
  /**
   * How many files were actually opened. Recording both is what lets a reader
   * judge how much of the map is grounded versus inferred.
   */
  filesRead: number;

  languages: string[];
  frameworks: string[];

  /** Characters in understanding.md — the injection cost, visible up front. */
  contentChars: number;

  error?: {
    message: string;
    at: number;
  };
}
