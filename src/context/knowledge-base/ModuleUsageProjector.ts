import * as fs from 'fs/promises';
import * as path from 'path';
import {
  MODULE_USAGE_FILE,
  MODULE_USAGE_SCHEMA_VERSION,
  MAX_RECENT_SUMMARIES,
  MAX_WARNINGS,
  MAX_SEEN_TASK_IDS,
  isValidModuleUsageIndexShape,
  type ModuleUsageIndex,
  type ModuleUsageRecord,
} from './moduleUsageTypes';
import type { KnowledgeBaseEntry } from './types';

function emptyIndex(): ModuleUsageIndex {
  return { version: 1, schemaVersion: MODULE_USAGE_SCHEMA_VERSION, updatedAt: Date.now(), modules: {} };
}

function emptyRecord(modulePath: string, entry: KnowledgeBaseEntry): ModuleUsageRecord {
  return {
    path: modulePath,
    touchCount: 0,
    lastTouchedAt: entry.createdAt,
    lastTouchedMode: entry.mode,
    recentSummaries: [],
    recentWarnings: [],
    seenTaskIds: [],
  };
}

/**
 * Derives a lightweight per-module usage sidecar from the knowledge-base task journal, so
 * architecture context can show "touched N times, most recently for X" without re-reading up
 * to 500 journal entries per prompt.
 */
export class ModuleUsageProjector {
  async project(workspaceRoot: string, entry: KnowledgeBaseEntry): Promise<void> {
    const index = (await this.load(workspaceRoot)) ?? emptyIndex();

    for (const changed of entry.changedFiles) {
      const modulePath = changed.path;
      const record = index.modules[modulePath] ?? emptyRecord(modulePath, entry);

      if (record.seenTaskIds.includes(entry.id)) {
        continue; // already projected this task's effect on this module — idempotency backstop
      }

      record.touchCount += 1;
      record.lastTouchedAt = entry.createdAt;
      record.lastTouchedMode = entry.mode;

      const summaryText = entry.implementationSummary ?? `${entry.mode} — ${entry.status}`;
      record.recentSummaries = [{ taskId: entry.id, at: entry.createdAt, summary: summaryText }, ...record.recentSummaries]
        .slice(0, MAX_RECENT_SUMMARIES);

      if (entry.warnings && entry.warnings.length > 0) {
        const newWarnings = entry.warnings.map(warning => ({ taskId: entry.id, at: entry.createdAt, warning }));
        record.recentWarnings = [...newWarnings, ...record.recentWarnings].slice(0, MAX_WARNINGS);
      }

      record.seenTaskIds = [...record.seenTaskIds, entry.id].slice(-MAX_SEEN_TASK_IDS);

      index.modules[modulePath] = record;
    }

    index.updatedAt = Date.now();
    await this.write(workspaceRoot, index);
  }

  async load(workspaceRoot: string): Promise<ModuleUsageIndex | undefined> {
    const filePath = path.join(workspaceRoot, MODULE_USAGE_FILE);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);
      if (!isValidModuleUsageIndexShape(parsed)) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private async write(workspaceRoot: string, index: ModuleUsageIndex): Promise<void> {
    const target = path.join(workspaceRoot, MODULE_USAGE_FILE);
    const dir = path.dirname(target);
    await fs.mkdir(dir, { recursive: true });

    const tmp = path.join(dir, `module-usage.json.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(index, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);
  }
}
