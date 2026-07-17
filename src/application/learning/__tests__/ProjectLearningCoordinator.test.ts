import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectLearningCoordinator } from '../ProjectLearningCoordinator';
import type { KnowledgeBaseWriter } from '../../../context/knowledge-base/KnowledgeBaseWriter';
import type { KnowledgeBaseEntry, NewKnowledgeBaseEntry } from '../../../context/knowledge-base/types';
import type { RefreshArchitectureMemoryUseCase } from '../../usecases/RefreshArchitectureMemoryUseCase';
import type { ModuleUsageProjector } from '../../../context/knowledge-base/ModuleUsageProjector';
import type { RetentionSweepUseCase } from '../../knowledge-facts/RetentionSweepUseCase';

function makeFakeKbWriter() {
  return {
    write: vi.fn().mockImplementation(async (workspaceRoot: string, input: NewKnowledgeBaseEntry): Promise<KnowledgeBaseEntry> => ({
      ...input,
      version: 1,
      schemaVersion: 'knowledge-base-entry-v1',
      id: 'fake-id',
      createdAt: Date.now(),
      workspaceRoot,
    })),
  } as unknown as KnowledgeBaseWriter;
}

function makeFakeRefresh() {
  return { execute: vi.fn().mockResolvedValue({ kind: 'skipped', reason: 'no-eligible-paths' }) } as unknown as RefreshArchitectureMemoryUseCase;
}

function makeFakeUsageProjector() {
  return { project: vi.fn().mockResolvedValue(undefined) } as unknown as ModuleUsageProjector;
}

function makeFakeRetentionSweep() {
  return { execute: vi.fn().mockResolvedValue({ evidenceTrimmed: 0, factsDeleted: 0 }) } as unknown as RetentionSweepUseCase;
}

function baseCompleteRunInput(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'edit' as const,
    providerId: 'nexus',
    originalPrompt: 'Fix the bug',
    status: 'completed' as const,
    source: 'task-pipeline' as const,
    ...overrides,
  };
}

describe('ProjectLearningCoordinator', () => {
  it('is a no-op on non-git workspaces without throwing', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-learning-coordinator-test-'));
    const kbWriter = makeFakeKbWriter();
    const refresh = makeFakeRefresh();
    const usage = makeFakeUsageProjector();
    const retention = makeFakeRetentionSweep();
    const coordinator = new ProjectLearningCoordinator(kbWriter, refresh, usage, retention);

    const handle = coordinator.beginRun(tmp, 'edit');
    await coordinator.completeRun(handle, baseCompleteRunInput());

    expect(kbWriter.write).toHaveBeenCalledTimes(1);
    expect((kbWriter.write as any).mock.calls[0][1].changedFiles).toEqual([]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('is idempotent — a second completeRun() on the same handle is a no-op', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-learning-coordinator-test-'));
    const kbWriter = makeFakeKbWriter();
    const refresh = makeFakeRefresh();
    const usage = makeFakeUsageProjector();
    const retention = makeFakeRetentionSweep();
    const coordinator = new ProjectLearningCoordinator(kbWriter, refresh, usage, retention);

    const handle = coordinator.beginRun(tmp, 'edit');
    await coordinator.completeRun(handle, baseCompleteRunInput());
    await coordinator.completeRun(handle, baseCompleteRunInput({ status: 'failed' }));

    expect(kbWriter.write).toHaveBeenCalledTimes(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('recordKnowledge:false skips the KB write but still attempts an architecture refresh', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-learning-coordinator-test-'));
    const kbWriter = makeFakeKbWriter();
    const refresh = makeFakeRefresh();
    const usage = makeFakeUsageProjector();
    const retention = makeFakeRetentionSweep();
    const coordinator = new ProjectLearningCoordinator(kbWriter, refresh, usage, retention);

    const handle = coordinator.beginRun(tmp, 'edit');
    await coordinator.completeRun(handle, baseCompleteRunInput({
      recordKnowledge: false,
      changedFilesOverride: [{ path: 'src/foo.ts', status: 'M' }],
    }));

    expect(kbWriter.write).not.toHaveBeenCalled();
    expect(refresh.execute).toHaveBeenCalledTimes(1);
    expect((refresh.execute as any).mock.calls[0][0].changedPaths).toEqual([{ path: 'src/foo.ts', status: 'M' }]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('changedFilesOverride is used directly, bypassing the internal git-status diff', async () => {
    // A non-existent directory means the internal getGitStatus() call would report
    // available:false and an empty changes list — if the override were ignored, both the
    // recorded KB entry and the refresh delta would be empty. They are not, proving the
    // override path was taken instead.
    const nonExistentDir = path.join(os.tmpdir(), 'nexus-learning-coordinator-does-not-exist');
    const kbWriter = makeFakeKbWriter();
    const refresh = makeFakeRefresh();
    const usage = makeFakeUsageProjector();
    const retention = makeFakeRetentionSweep();
    const coordinator = new ProjectLearningCoordinator(kbWriter, refresh, usage, retention);

    const handle = coordinator.beginRun(nonExistentDir, 'edit');
    await coordinator.completeRun(handle, baseCompleteRunInput({
      changedFilesOverride: [{ path: 'src/core/Foo.ts', status: 'M' }],
    }));

    expect((kbWriter.write as any).mock.calls[0][1].changedFiles).toEqual([{ path: 'src/core/Foo.ts', status: 'M' }]);
    expect((refresh.execute as any).mock.calls[0][0].changedPaths).toEqual([{ path: 'src/core/Foo.ts', status: 'M' }]);
  });

  it('does not trigger an architecture refresh when there are no changed paths', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-learning-coordinator-test-'));
    const kbWriter = makeFakeKbWriter();
    const refresh = makeFakeRefresh();
    const usage = makeFakeUsageProjector();
    const retention = makeFakeRetentionSweep();
    const coordinator = new ProjectLearningCoordinator(kbWriter, refresh, usage, retention);

    const handle = coordinator.beginRun(tmp, 'edit');
    await coordinator.completeRun(handle, baseCompleteRunInput());

    expect(refresh.execute).not.toHaveBeenCalled();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('never throws when the knowledge-base write fails', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-learning-coordinator-test-'));
    const kbWriter = { write: vi.fn().mockRejectedValue(new Error('disk full')) } as unknown as KnowledgeBaseWriter;
    const refresh = makeFakeRefresh();
    const usage = makeFakeUsageProjector();
    const retention = makeFakeRetentionSweep();
    const coordinator = new ProjectLearningCoordinator(kbWriter, refresh, usage, retention);

    const handle = coordinator.beginRun(tmp, 'edit');
    await expect(coordinator.completeRun(handle, baseCompleteRunInput())).resolves.toBeUndefined();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('throttles the retention sweep to at most once per coordinator instance within the window', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-learning-coordinator-test-'));
    const kbWriter = makeFakeKbWriter();
    const refresh = makeFakeRefresh();
    const usage = makeFakeUsageProjector();
    const retention = makeFakeRetentionSweep();
    const coordinator = new ProjectLearningCoordinator(kbWriter, refresh, usage, retention);

    const handle1 = coordinator.beginRun(tmp, 'edit');
    await coordinator.completeRun(handle1, baseCompleteRunInput());
    const handle2 = coordinator.beginRun(tmp, 'edit');
    await coordinator.completeRun(handle2, baseCompleteRunInput());

    expect(retention.execute).toHaveBeenCalledTimes(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
