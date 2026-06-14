import type { IEventBus, NexusEvent } from '../../core/events/IEventBus';
import { AgentTask } from '../../core/agent';
import type { RunAgentUseCase } from '../usecases/RunAgentUseCase';
import { AgentSessionStore } from './AgentSessionStore';
import { AgentTimeline } from './AgentTimeline';
import { AgentPlanner } from './AgentPlanner';
import { AgentCheckpoint } from './AgentCheckpoint';
import { AgentTestRunner } from './AgentTestRunner';
import { AgentRecovery } from './AgentRecovery';
import { AgentReviewRunner } from './AgentReviewRunner';
import { AgentDiffCollector } from './AgentDiffCollector';
import { AgentFinalReporter } from './AgentFinalReporter';
import { AgentBranchManager } from './AgentBranchManager';
import { loadAgentModePolicy, type AgentModePolicy } from './AgentModePolicy';
import type { AgentSession, AgentSessionStatus } from './AgentSession';
import type { AgentStep, AgentStepType } from './AgentStep';
import type { AgentTestResult } from './AgentTestRunner';
import type { AgentDiffSummary } from './AgentDiffCollector';
import type { AgentFinalSummary } from './AgentFinalReporter';
import type { AgentRecoveryResult } from './AgentRecovery';
import type { AgentReviewResult } from './AgentReviewRunner';
import type { PermissionService } from '../permissions/PermissionService';

export interface RunAgentModeInput {
  prompt: string;
  workspaceRoot: string;
  providerId: string;
  model?: string;
  baseBranch?: string;
  conversationContext?: string;
  attachments?: unknown[];
  subagentsEnabled?: boolean;
}

export class AgentExecutor {
  private readonly sessionStores = new Map<string, AgentSessionStore>();

  constructor(
    private readonly runAgentUseCase: RunAgentUseCase,
    private readonly eventBus: IEventBus,
    private readonly post: (msg: unknown) => void,
    private readonly permissionService?: PermissionService,
  ) {}

  private getStore(workspaceRoot: string): AgentSessionStore {
    if (!this.sessionStores.has(workspaceRoot)) {
      this.sessionStores.set(workspaceRoot, new AgentSessionStore(workspaceRoot));
    }
    return this.sessionStores.get(workspaceRoot)!;
  }

  async run(input: RunAgentModeInput): Promise<void> {
    const policy = loadAgentModePolicy();

    if (!policy.enabled) {
      this.emitError('Agent Mode is disabled. Enable it in Settings (nexus.agentMode.enabled).');
      return;
    }

    const store = this.getStore(input.workspaceRoot);
    const timeline = new AgentTimeline(input.workspaceRoot, this.eventBus);

    const session = store.create({
      workspaceRoot: input.workspaceRoot,
      originalPrompt: input.prompt,
      providerId: input.providerId,
      model: input.model,
      baseBranch: input.baseBranch,
    });

    this.postAgentMessage({ type: 'agentSessionUpdated', session: toSessionViewModel(session) });
    await timeline.append({ sessionId: session.id, type: 'session_created', message: 'Agent session created.' });

    try {
      // Optional: create working branch
      const branchManager = new AgentBranchManager();
      if (policy.useWorkingBranch) {
        try {
          const baseBranch = branchManager.getCurrentBranch(input.workspaceRoot);
          if (baseBranch) {
            session.baseBranch = baseBranch;
          }
          const workingBranch = await branchManager.createWorkingBranch(session, policy);
          if (workingBranch) {
            session.workingBranch = workingBranch;
            store.update(session);
          }
        } catch (err) {
          // Branch creation failure is non-fatal — continue on current branch
          await timeline.append({ sessionId: session.id, type: 'step_failed', message: `Branch creation failed: ${String(err)} — continuing on current branch.` });
        }
      }

      // Step: scan + plan
      await this.runStep(session, store, timeline, 'scan_project', 'Scanning project', async () => {
        this.setSessionStatus(session, store, 'scanning');
      });

      await this.runStep(session, store, timeline, 'plan', 'Creating implementation plan', async () => {
        this.setSessionStatus(session, store, 'planning');

        const planner = new AgentPlanner(
          async (prompt, workspaceRoot, providerId, model) => {
            return await this.runAgentForText(prompt, workspaceRoot, providerId, model);
          },
        );

        const result = await planner.plan({
          session,
          prompt: input.prompt,
          workspaceRoot: input.workspaceRoot,
          providerId: input.providerId,
          model: input.model,
          conversationContext: input.conversationContext,
        });

        session.plan = result.plan;
        session.planText = result.planText;
        store.update(session);
      });

      if (policy.requirePlanApproval) {
        // Emit plan for approval and wait
        this.setSessionStatus(session, store, 'waiting_approval');

        this.postAgentMessage({
          type: 'agentPlanReadyForApproval',
          sessionId: session.id,
          plan: session.plan!,
          planText: session.planText ?? '',
        });
        this.postAgentMessage({ type: 'agentSessionUpdated', session: toSessionViewModel(session) });

        await timeline.append({ sessionId: session.id, type: 'approval_requested', message: 'Plan ready — waiting for user approval.' });

        // Return here — execution resumes via continueAfterApproval()
        return;
      }

      // No approval required — continue directly
      await this.continueAfterApproval(session.id, policy, store, timeline);
    } catch (err) {
      const msg = String(err);
      store.markFailed(session.id, msg);
      const updated = store.get(session.id) ?? session;
      this.postAgentMessage({ type: 'agentSessionUpdated', session: toSessionViewModel(updated) });
      await timeline.append({ sessionId: session.id, type: 'session_failed', message: `Session failed: ${msg}` });
      this.emitError(msg);
    }
  }

  async continueAfterApproval(
    sessionId: string,
    policyOverride?: AgentModePolicy,
    _storeOverride?: AgentSessionStore,
    timelineOverride?: AgentTimeline,
  ): Promise<void> {
    const policy = policyOverride ?? loadAgentModePolicy();

    // Find session (we need workspaceRoot to find the store)
    // Search known stores
    let session: AgentSession | undefined;
    let store: AgentSessionStore | undefined;

    for (const [, s] of this.sessionStores) {
      const found = s.get(sessionId);
      if (found) {
        session = found;
        store = s;
        break;
      }
    }

    if (!session || !store) {
      this.emitError(`Agent session not found: ${sessionId}`);
      return;
    }

    if (session.status !== 'waiting_approval' && session.status !== 'planning') {
      this.emitError(`Session ${sessionId} is not waiting for approval (status: ${session.status})`);
      return;
    }

    session.approvedAt = Date.now();
    store.update(session);

    const timeline = timelineOverride ?? new AgentTimeline(session.workspaceRoot, this.eventBus);

    this.postAgentMessage({ type: 'agentPlanApproved', sessionId });
    await timeline.append({ sessionId, type: 'approval_received', message: 'Plan approved by user.' });

    try {
      let testResult: AgentTestResult | undefined;
      let recoveryResult: AgentRecoveryResult | undefined;
      let reviewResult: AgentReviewResult | undefined;
      let diffSummary: AgentDiffSummary | undefined;

      // Checkpoint
      if (policy.createCheckpointBeforeEdit) {
        await this.runStep(session, store, timeline, 'checkpoint', 'Creating checkpoint', async () => {
          this.setSessionStatus(session!, store!, 'checkpointing');
          const checkpoint = new AgentCheckpoint();
          const record = await checkpoint.create(session!);
          session!.checkpointIds.push(record.id);
          store!.update(session!);
          this.postAgentMessage({ type: 'agentCheckpointCreated', sessionId, checkpointId: record.id });
          await timeline.append({ sessionId, type: 'checkpoint_created', message: `Checkpoint created: ${record.id}` });
        });
      }

      // Edit
      await this.runStep(session, store, timeline, 'edit', 'Implementing changes', async () => {
        this.setSessionStatus(session!, store!, 'executing');
        await this.runEdit(session!, policy);
      });

      // Tests
      if (policy.autoRunTests) {
        await this.runStep(session, store, timeline, 'run_tests', 'Running tests', async () => {
          this.setSessionStatus(session!, store!, 'testing');
          const testRunner = new AgentTestRunner();
          await timeline.append({ sessionId, type: 'test_started', message: 'Running tests.' });
          // Status callback: test runner sets waiting_permission only when ACTUALLY awaiting
          // a specific command approval. Returns to testing once user decides.
          const onStatusChange = (status: import('./AgentSession').AgentSessionStatus) => {
            this.setSessionStatus(session!, store!, status);
          };
          testResult = await testRunner.run(session!, policy, this.permissionService, onStatusChange);
          // Restore testing status after all commands processed
          this.setSessionStatus(session!, store!, 'testing');
          this.postAgentMessage({ type: 'agentTestResult', sessionId, result: toTestResultViewModel(testResult) });
          await timeline.append({ sessionId, type: 'test_completed', message: `Tests ${testResult.passed ? 'passed' : 'failed'}.` });
        });

        // Recovery
        if (testResult && !testResult.passed && policy.autoFixTestFailures && policy.maxRecoveryAttempts > 0) {
          await this.runStep(session, store, timeline, 'fix_tests', 'Fixing test failures', async () => {
            this.setSessionStatus(session!, store!, 'recovering');
            const diffCollector = new AgentDiffCollector();
            const permSvc = this.permissionService;
            const recovery = new AgentRecovery(
              async (prompt, workspaceRoot, providerId, model) => {
                await this.runAgentForText(prompt, workspaceRoot, providerId, model);
              },
              async (s, p) => new AgentTestRunner().run(s, p, permSvc),
              async (s) => {
                const d = await diffCollector.collect(s, policy);
                return { diff: d.diff };
              },
            );
            await timeline.append({ sessionId, type: 'recovery_started', message: 'Starting recovery from test failures.' });
            recoveryResult = await recovery.recover(session!, testResult!, policy);
            testResult = recoveryResult.finalTestResult ?? testResult;
            this.postAgentMessage({ type: 'agentRecoveryResult', sessionId, result: recoveryResult });
            await timeline.append({ sessionId, type: 'recovery_completed', message: `Recovery ${recoveryResult.recovered ? 'succeeded' : 'failed'}.` });
          });
        }
      }

      // Review
      await this.runStep(session, store, timeline, 'review', 'Reviewing changes', async () => {
        this.setSessionStatus(session!, store!, 'reviewing');
        const diffCollector = new AgentDiffCollector();
        const reviewer = new AgentReviewRunner(
          async (prompt, workspaceRoot, providerId, model) => {
            return await this.runAgentForText(prompt, workspaceRoot, providerId, model);
          },
          async (s) => {
            const d = await diffCollector.collect(s, policy);
            return { diff: d.diff, diffStat: d.diffStat };
          },
        );
        reviewResult = await reviewer.review(session!);
        this.postAgentMessage({ type: 'agentReviewResult', sessionId, result: reviewResult });
        await timeline.append({ sessionId, type: 'review_completed', message: `Review ${reviewResult.passed ? 'passed' : 'found issues'}.` });
      });

      // Diff
      if (policy.collectFinalDiff) {
        await this.runStep(session, store, timeline, 'collect_diff', 'Collecting diff', async () => {
          this.setSessionStatus(session!, store!, 'collecting_diff');
          const diffCollector = new AgentDiffCollector();
          diffSummary = await diffCollector.collect(session!, policy);
          this.postAgentMessage({ type: 'agentDiffCollected', sessionId, diff: toDiffViewModel(diffSummary) });
          await timeline.append({ sessionId, type: 'diff_collected', message: `Diff collected: ${diffSummary.changedFiles.length} file(s) changed.` });
        });
      }

      // Final summary
      await this.runStep(session, store, timeline, 'final_summary', 'Generating final report', async () => {
        const reporter = new AgentFinalReporter();
        const summary = await reporter.build(session!, { testResult, recoveryResult, reviewResult, diffSummary });
        store!.markCompleted(sessionId);
        const completed = store!.get(sessionId) ?? session!;
        this.postAgentMessage({ type: 'agentSessionUpdated', session: toSessionViewModel(completed) });
        this.postAgentMessage({ type: 'agentFinalSummary', sessionId, summary: toFinalSummaryViewModel(summary) });
        await timeline.append({ sessionId, type: 'session_completed', message: `Session completed with status: ${summary.status}` });
      });
    } catch (err) {
      const msg = String(err);
      store.markFailed(sessionId, msg);
      const failed = store.get(sessionId) ?? session;
      this.postAgentMessage({ type: 'agentSessionUpdated', session: toSessionViewModel(failed) });
      await timeline.append({ sessionId, type: 'session_failed', message: `Session failed: ${msg}` });
      this.emitError(msg);
    }
  }

  async rejectPlan(sessionId: string, reason?: string): Promise<void> {
    let session: AgentSession | undefined;
    let store: AgentSessionStore | undefined;

    for (const [, s] of this.sessionStores) {
      const found = s.get(sessionId);
      if (found) { session = found; store = s; break; }
    }

    if (!session || !store) return;

    session.rejectedAt = Date.now();
    session.rejectReason = reason;
    session.status = 'cancelled';
    store.update(session);

    const timeline = new AgentTimeline(session.workspaceRoot, this.eventBus);
    await timeline.append({ sessionId, type: 'approval_rejected', message: `Plan rejected${reason ? ': ' + reason : ''}.` });

    this.postAgentMessage({ type: 'agentPlanRejected', sessionId, reason });
    this.postAgentMessage({ type: 'agentSessionUpdated', session: toSessionViewModel(session) });
  }

  private setSessionStatus(session: AgentSession, store: AgentSessionStore, status: AgentSessionStatus): void {
    session.status = status;
    store.update(session);
    this.postAgentMessage({ type: 'agentSessionUpdated', session: toSessionViewModel(session) });
  }

  private async runStep<T>(
    session: AgentSession,
    store: AgentSessionStore,
    timeline: AgentTimeline,
    type: AgentStepType,
    title: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const step: AgentStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sessionId: session.id,
      type,
      title,
      status: 'running',
      startedAt: Date.now(),
    };

    session.currentStepId = step.id;
    store.appendStep(session.id, step);
    this.postAgentMessage({ type: 'agentStepStarted', sessionId: session.id, step: toStepViewModel(step) });
    await timeline.append({ sessionId: session.id, type: 'step_started', message: `Step started: ${title}` });

    try {
      const result = await fn();
      step.status = 'completed';
      step.completedAt = Date.now();
      store.updateStep(session.id, step);
      this.postAgentMessage({ type: 'agentStepCompleted', sessionId: session.id, step: toStepViewModel(step) });
      await timeline.append({ sessionId: session.id, type: 'step_completed', message: `Step completed: ${title}` });
      return result;
    } catch (err) {
      step.status = 'failed';
      step.completedAt = Date.now();
      step.error = String(err);
      store.updateStep(session.id, step);
      this.postAgentMessage({ type: 'agentStepFailed', sessionId: session.id, step: toStepViewModel(step), error: String(err) });
      await timeline.append({ sessionId: session.id, type: 'step_failed', message: `Step failed: ${title}: ${String(err)}` });
      throw err;
    }
  }

  private async runEdit(session: AgentSession, _policy: AgentModePolicy): Promise<void> {
    const editPrompt = buildEditPrompt(session);

    // Use NexusOrchestrator for nexus provider, RunAgentUseCase for direct providers
    const { workspaceRoot, providerId, model } = session;

    const task = new AgentTask(
      session.originalPrompt,
      editPrompt,
      providerId as any,
      'edit',
      model,
      workspaceRoot,
    );

    await this.runAgentUseCase.execute(task);
  }

  private async runAgentForText(
    prompt: string,
    workspaceRoot: string,
    providerId: string,
    model?: string,
  ): Promise<string> {
    const chunks: string[] = [];

    const task = new AgentTask(
      prompt,
      prompt,
      providerId as any,
      'ask',
      model,
      workspaceRoot,
    );

    const onStdout = (event: NexusEvent) => {
      if (event.kind === 'stdout' && event.task.id === task.id) {
        chunks.push(event.chunk);
      }
    };

    this.eventBus.on('stdout', onStdout);
    try {
      await this.runAgentUseCase.execute(task);
    } finally {
      this.eventBus.off('stdout', onStdout);
    }

    return chunks.join('');
  }

  private emitError(message: string): void {
    const fakeTask = new AgentTask('', '', 'nexus' as any, 'agent' as any, undefined, '');
    this.eventBus.emit({ kind: 'task_error', task: fakeTask, error: message });
  }

  private postAgentMessage(msg: unknown): void {
    this.post(msg);
  }
}

// ── View model mappers ─────────────────────────────────────────────────────

function toSessionViewModel(session: AgentSession) {
  return {
    id: session.id,
    status: session.status,
    originalPrompt: session.originalPrompt,
    currentStepId: session.currentStepId,
    steps: session.steps.map(toStepViewModel),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    error: session.error,
  };
}

function toStepViewModel(step: AgentStep) {
  return {
    id: step.id,
    type: step.type,
    title: step.title,
    status: step.status,
    error: step.error,
  };
}

function toTestResultViewModel(result: AgentTestResult) {
  return {
    sessionId: result.sessionId,
    passed: result.passed,
    commands: result.commands.map(c => ({
      command: c.command,
      exitCode: c.exitCode,
      stdout: c.stdout,
      stderr: c.stderr,
      durationMs: c.durationMs,
      passed: c.passed,
    })),
    durationMs: result.durationMs,
  };
}

function toDiffViewModel(diff: AgentDiffSummary) {
  return {
    sessionId: diff.sessionId,
    changedFiles: diff.changedFiles.map(f => ({
      path: f.path,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
    addedLines: diff.addedLines,
    deletedLines: diff.deletedLines,
    diffStat: diff.diffStat,
    diff: diff.diff,
    diffTruncated: diff.diffTruncated,
  };
}

function toFinalSummaryViewModel(summary: AgentFinalSummary) {
  return {
    sessionId: summary.sessionId,
    status: summary.status,
    userTask: summary.userTask,
    implementationSummary: summary.implementationSummary,
    changedFiles: summary.changedFiles.map(f => ({
      path: f.path,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
    warnings: summary.warnings,
    nextSteps: summary.nextSteps,
  };
}

function buildEditPrompt(session: AgentSession): string {
  const plan = session.plan;
  return `You are Nexus Agent Mode Executor.

User task:
${session.originalPrompt}

Approved implementation plan:
${session.planText ?? '(no plan text)'}

Hard rules:
- Follow only the approved plan.
- Do not delete files unless filesToDelete explicitly lists them.
- Do not run terminal commands.
- Do not install dependencies unless explicitly approved.
- Keep changes minimal and scoped.
- Preserve existing project architecture and style.
- Use existing utilities and patterns.
- After editing, tests will be run by Agent Mode.
- If you need to expand scope, stop and report why.

${plan?.filesToEdit?.length ? `Files expected to edit:\n${plan.filesToEdit.join('\n')}` : ''}
${plan?.filesToCreate?.length ? `Files expected to create:\n${plan.filesToCreate.join('\n')}` : ''}

Important:
- Do not modify binary assets.
- Do not modify bundled build output unless explicitly required.
- Do not touch archived or generated files.`;
}
