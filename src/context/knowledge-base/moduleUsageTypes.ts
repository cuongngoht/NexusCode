import type { TaskMode } from '../../core/agent/AgentTask';

export const MODULE_USAGE_SCHEMA_VERSION = 'module-usage-v1';
export const MODULE_USAGE_FILE = '.nexus/knowledge-base/module-usage.json';

export const MAX_RECENT_SUMMARIES = 2;
export const MAX_WARNINGS = 3;
export const MAX_SEEN_TASK_IDS = 50;

export interface ModuleUsageSummaryEntry {
  taskId: string;
  at: number;
  summary: string;
}

export interface ModuleUsageWarningEntry {
  taskId: string;
  at: number;
  warning: string;
}

export interface ModuleUsageRecord {
  path: string;
  touchCount: number;
  lastTouchedAt: number;
  lastTouchedMode: TaskMode;
  /** Capped at MAX_RECENT_SUMMARIES, newest first. */
  recentSummaries: ModuleUsageSummaryEntry[];
  /** Capped at MAX_WARNINGS, newest first. */
  recentWarnings: ModuleUsageWarningEntry[];
  /** Bounded ring buffer of task IDs already projected into this module — idempotency backstop. */
  seenTaskIds: string[];
}

export interface ModuleUsageIndex {
  version: 1;
  schemaVersion: typeof MODULE_USAGE_SCHEMA_VERSION;
  updatedAt: number;
  modules: Record<string, ModuleUsageRecord>;
}

export function isValidModuleUsageIndexShape(value: unknown): value is ModuleUsageIndex {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v['version'] === 1 &&
    v['schemaVersion'] === MODULE_USAGE_SCHEMA_VERSION &&
    typeof v['modules'] === 'object' &&
    v['modules'] !== null
  );
}
