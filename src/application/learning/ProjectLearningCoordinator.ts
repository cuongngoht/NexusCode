import { randomUUID } from 'crypto';
import type { TaskMode } from '../../core/agent/AgentTask';
import type { GitFileChange } from '../../core/types';
import { KnowledgeBaseWriter } from '../../context/knowledge-base/KnowledgeBaseWriter';
import type { KnowledgeBaseEntryStatus, KnowledgeBaseEntrySource } from '../../context/knowledge-base/types';
import { ModuleUsageProjector } from '../../context/knowledge-base/ModuleUsageProjector';
import { getGitStatus } from '../../git/gitStatus';
import { diffGitSnapshots, type ResolvedChange } from '../../git/ChangedFilePathResolver';
import { RefreshArchitectureMemoryUseCase } from '../usecases/RefreshArchitectureMemoryUseCase';
import { RetentionSweepUseCase } from '../knowledge-facts/RetentionSweepUseCase';

const RETENTION_SWEEP_THROTTLE_MS = 24 * 60 * 60 * 1000;

export interface RunHandle {
  readonly runId: string;
  readonly workspaceRoot: string;
  readonly mode: TaskMode;
  readonly startedAt: number;
}

export interface CompleteRunInput {
  mode: TaskMode;
  providerId: string;
  model?: string;
  originalPrompt: string;
  skillIds?: string[];
  status: KnowledgeBaseEntryStatus;
  source: KnowledgeBaseEntrySource;
  implementationSummary?: string;
  warnings?: string[];
  nextSteps?: string[];
  /** Callers that already computed their own changed-file list (e.g. AgentExecutor's diff
   *  collector) may pass it to skip this coordinator's own getGitStatus call entirely — it is
   *  used both as the recorded KB entry's changedFiles and as the architecture-refresh delta. */
  changedFilesOverride?: GitFileChange[];
  /** false = never persist an independent knowledge-base entry for this handle (e.g. a
   *  supplementary/non-primary step whose work is already recorded by the primary step). */
  recordKnowledge?: boolean;
}

interface InternalHandleState {
  preSnapshot: GitFileChange[];
  settled: boolean;
}

/**
 * Centralizes the post-task learning hooks that used to be scattered across every mode's own
 * KnowledgeBaseWriter.write() call site. beginRun()/completeRun() give every call site the same
 * idempotency guarantee (a second completeRun() on an already-settled handle is a no-op) and the
 * same fire-and-forget architecture-memory refresh, without each caller re-deriving git status.
 */
export class ProjectLearningCoordinator {
  private readonly handles = new Map<string, InternalHandleState>();
  private lastRetentionSweepAt = 0;

  constructor(
    private readonly kbWriter: KnowledgeBaseWriter = new KnowledgeBaseWriter(),
    private readonly refreshArchitectureMemory: RefreshArchitectureMemoryUseCase = new RefreshArchitectureMemoryUseCase(),
    private readonly usageProjector: ModuleUsageProjector = new ModuleUsageProjector(),
    private readonly retentionSweep: RetentionSweepUseCase = new RetentionSweepUseCase(),
  ) {}

  beginRun(workspaceRoot: string, mode: TaskMode): RunHandle {
    const runId = randomUUID();
    const preSnapshot = getGitStatus(workspaceRoot).changes;
    this.handles.set(runId, { preSnapshot, settled: false });
    return { runId, workspaceRoot, mode, startedAt: Date.now() };
  }

  async completeRun(handle: RunHandle, input: CompleteRunInput): Promise<void> {
    const state = this.handles.get(handle.runId);
    if (state?.settled) {
      return;
    }
    if (state) {
      state.settled = true;
    }

    let changedFiles: GitFileChange[];
    let taskDeltaPaths: ResolvedChange[];

    if (input.changedFilesOverride) {
      changedFiles = input.changedFilesOverride;
      taskDeltaPaths = input.changedFilesOverride.map(c => ({ path: c.path, status: c.status }));
    } else {
      const preSnapshot = state?.preSnapshot ?? [];
      const postSnapshot = getGitStatus(handle.workspaceRoot).changes;
      const diff = diffGitSnapshots(preSnapshot, postSnapshot);
      changedFiles = diff.workspaceChangedPaths.map(c => ({ path: c.path, status: c.status }));
      taskDeltaPaths = diff.taskDeltaPaths;
    }

    if (input.recordKnowledge !== false) {
      try {
        const entry = await this.kbWriter.write(handle.workspaceRoot, {
          mode: input.mode,
          providerId: input.providerId,
          model: input.model,
          originalPrompt: input.originalPrompt,
          skillIds: input.skillIds,
          status: input.status,
          changedFiles,
          source: input.source,
          implementationSummary: input.implementationSummary,
          warnings: input.warnings,
          nextSteps: input.nextSteps,
        });
        void this.usageProjector.project(handle.workspaceRoot, entry).catch(() => { /* best-effort */ });
      } catch {
        // best-effort — never fail the pipeline on a knowledge-base write error
      }
    }

    if (taskDeltaPaths.length > 0) {
      void this.refreshArchitectureMemory
        .execute({ workspaceRoot: handle.workspaceRoot, changedPaths: taskDeltaPaths })
        .catch(() => { /* best-effort — architecture refresh must never fail the task */ });
    }

    // Throttled to at most once per day per coordinator instance — a full facts-store sweep on
    // every single task would be wasteful; this is not a cross-process cron, just an in-memory guard.
    const now = Date.now();
    if (now - this.lastRetentionSweepAt >= RETENTION_SWEEP_THROTTLE_MS) {
      this.lastRetentionSweepAt = now;
      void this.retentionSweep.execute(handle.workspaceRoot).catch(() => { /* best-effort */ });
    }
  }
}
