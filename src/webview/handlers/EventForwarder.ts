import type { ExtensionMessage } from '../webviewProtocol';
import type { NexusEvent } from '../../core/events/IEventBus';
import type { NexusStreamEvent } from '../../core/stream/NexusStreamEvent';

export class EventForwarder {
  constructor(private readonly post: (msg: ExtensionMessage) => void) {}

  private _postNexus(event: NexusStreamEvent): void {
    this.post({ type: 'nexusStreamEvent', event });
  }

  forward(event: NexusEvent): void {
    switch (event.kind) {
      case 'task_started':
        this.post({
          type: 'taskStarted',
          taskId: event.task.id,
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          enhancedPrompt: event.enhancedPrompt ?? event.task.enhancedPrompt,
          enhancedPromptSections: event.enhancedPromptSections,
        });
        this._postNexus({
          kind: 'task.started',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
        });
        break;
      case 'stdout':
        if (!event.suppressChat) {
          this.post({ type: 'stdout', chunk: event.chunk });
        }
        this._postNexus({
          kind: 'provider.raw',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          chunk: event.chunk,
          stream: 'stdout',
        });
        break;
      case 'reasoning':
        this.post({ type: 'reasoning', chunk: event.chunk });
        this._postNexus({
          kind: 'step.reasoning',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          text: event.chunk,
        });
        // Also surface in raw log for full fidelity (extracted reasoning tokens)
        this._postNexus({
          kind: 'provider.raw',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          chunk: event.chunk,
          stream: 'stdout',
        });
        break;
      case 'stderr':
        this.post({ type: 'stderr', chunk: event.chunk });
        this._postNexus({
          kind: 'provider.raw',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          chunk: event.chunk,
          stream: 'stderr',
        });
        break;
      case 'task_completed':
        this.post({ type: 'taskCompleted', taskId: event.task.id, exitCode: event.result.exitCode });
        this._postNexus({
          kind: 'task.completed',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          exitCode: event.result.exitCode,
        });
        break;
      case 'task_stopped':
        this.post({ type: 'taskStopped', taskId: event.task.id });
        // task_stopped is not a direct NexusStreamEvent variant — treat as completed with exitCode -1
        this._postNexus({
          kind: 'task.completed',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          exitCode: -1,
        });
        break;
      case 'task_error':
        this.post({ type: 'taskError', taskId: event.task.id, message: event.error });
        this._postNexus({
          kind: 'task.failed',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          error: event.error,
        });
        break;
      case 'step_started':
        this.post({
          type: 'stepStarted',
          stepLabel: event.stepLabel,
          stepIndex: event.stepIndex,
          totalSteps: event.totalSteps,
          provider: event.provider,
          mode: event.mode,
          model: event.model,
        });
        this._postNexus({
          kind: 'step.started',
          taskId: `step-${event.stepLabel}`,
          timestamp: Date.now(),
          provider: event.provider,
          mode: event.mode,
          model: event.model,
          label: event.stepLabel,
          index: event.stepIndex,
          total: event.totalSteps,
        });
        break;
      case 'step_completed':
        this.post({ type: 'stepCompleted', stepLabel: event.stepLabel });
        this._postNexus({
          kind: 'step.completed',
          taskId: `step-${event.stepLabel}`,
          timestamp: Date.now(),
          provider: '',
          mode: '',
          label: event.stepLabel,
        });
        break;
      case 'step_error':
        this.post({ type: 'stepError', stepLabel: event.stepLabel, error: event.error });
        break;
      case 'activity_started':
        this.post({ type: 'activityStarted', activityKind: event.activityKind, label: event.label });
        this._postNexus({
          kind: 'tool.started',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          toolName: event.label,
          toolKind: event.activityKind,
        });
        break;
      case 'activity_done':
        this.post({ type: 'activityDone', activityKind: event.activityKind, label: event.label, status: event.status });
        this._postNexus({
          kind: 'tool.completed',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          toolName: event.label,
          status: event.status,
        });
        break;
      case 'token_usage_updated':
        this.post({
          type: 'tokenUsageUpdated',
          taskId: event.task.id,
          phase: event.phase,
          usage: event.usage,
        });
        this._postNexus({
          kind: 'token.usage',
          taskId: event.task.id,
          timestamp: Date.now(),
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          phase: event.phase,
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
        });
        break;
      case 'plan_saved':
        this.post({ type: 'planSaved', taskId: event.task.id, planPath: event.planPath });
        break;
      case 'plan_ready_for_approval':
        this.post({
          type: 'planReadyForApproval',
          taskId: event.task.id,
          planPath: event.planPath,
          plan: event.plan,
          mode: event.mode,
          model: event.model,
        });
        break;
      case 'summarize_started':
      case 'summarize_completed':
      case 'summarize_error':
        // These events do not have corresponding webview messages — handled elsewhere if needed
        break;
      case 'debug_state_changed':
        // Internal state machine telemetry — not user-visible for now.
        break;

      case 'debug_bm25_results': {
        const lines = event.results.map(r => `  - ${r.path} (score ${r.score.toFixed(2)}${r.reason ? ` — ${r.reason}` : ''})`).join('\n');
        this.post({ type: 'stdout', chunk: `\n[BM25] Top results:\n${lines}\n` });
        break;
      }

      case 'debug_evidence_found': {
        const lines = event.evidence.map(e => `  - ${e}`).join('\n');
        this.post({ type: 'stdout', chunk: `\n[Evidence collected]\n${lines}\n` });
        break;
      }

      case 'debug_plan_ready':
      case 'debug_approval_required':
        // These drive the shared PlanReadyCard via the dual 'plan_ready_for_approval' emit
        // done inside DebugPlanStep. No extra action here.
        break;

      case 'debug_verification_started':
        this.post({ type: 'stdout', chunk: `\n[Verification] Running: ${event.command ?? '(unknown)'}\n` });
        break;

      case 'debug_verification_completed': {
        const status = event.succeeded ? 'succeeded' : 'failed';
        const out = event.output ? `\n${event.output}\n` : '';
        this.post({ type: 'stdout', chunk: `\n[Verification ${status}]${out}` });
        break;
      }

      case 'debug_summary_ready':
        this.post({ type: 'stdout', chunk: `\n${event.summary}\n` });
        break;

      case 'subagent_started':
        this.post({ type: 'subagentStarted', runId: event.runId, role: event.role, displayName: event.displayName });
        break;
      case 'subagent_completed':
        this.post({
          type: 'subagentCompleted',
          runId: event.runId,
          role: event.role,
          durationMs: event.durationMs,
          confidence: event.confidence,
          findingCount: event.findingCount,
        });
        break;
      case 'subagent_failed':
        this.post({ type: 'subagentFailed', runId: event.runId, role: event.role, durationMs: event.durationMs, error: event.error });
        break;
    }
  }
}
