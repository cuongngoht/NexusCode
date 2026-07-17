import * as fs from 'fs/promises';
import * as path from 'path';
import { KnowledgeBaseLoader } from '../../context/knowledge-base/KnowledgeBaseLoader';
import { ModuleUsageProjector } from '../../context/knowledge-base/ModuleUsageProjector';
import { MODULE_USAGE_FILE } from '../../context/knowledge-base/moduleUsageTypes';

export interface BackfillModuleUsageOutput {
  backfilled: boolean;
  entriesProjected: number;
}

/**
 * One-time projection of the entire historical knowledge-base task journal into the module-usage
 * sidecar, for workspaces that scanned before Release 1b existed. Runs at most once per
 * workspace — subsequent scans no-op once the sidecar file exists, since incremental projection
 * from that point on happens via ProjectLearningCoordinator after every task.
 */
export class BackfillModuleUsageUseCase {
  constructor(
    private readonly loader: KnowledgeBaseLoader = new KnowledgeBaseLoader(),
    private readonly projector: ModuleUsageProjector = new ModuleUsageProjector(),
  ) {}

  async execute(workspaceRoot: string): Promise<BackfillModuleUsageOutput> {
    const sidecarPath = path.join(workspaceRoot, MODULE_USAGE_FILE);
    const alreadyExists = await fs.access(sidecarPath).then(() => true).catch(() => false);
    if (alreadyExists) {
      return { backfilled: false, entriesProjected: 0 };
    }

    // Explicit override of the loader's hot-path-protecting default limit — a one-time backfill
    // is exactly the sanctioned use case for this parameter, not a workaround.
    const entries = await this.loader.loadRecentEntries(workspaceRoot, { limit: Number.MAX_SAFE_INTEGER });
    const chronological = [...entries].reverse(); // loader returns newest-first; project oldest-first
    // so recentSummaries/recentWarnings end up correctly ordered newest-first.

    for (const entry of chronological) {
      await this.projector.project(workspaceRoot, entry);
    }

    return { backfilled: true, entriesProjected: chronological.length };
  }
}
