import type { ExtensionMessage } from '../webviewProtocol';
import type { NexusEvent } from '../../core/events/IEventBus';

export class EventForwarder {
  constructor(private readonly post: (msg: ExtensionMessage) => void) {}

  forward(event: NexusEvent): void {
    switch (event.kind) {
      case 'task_started':
        this.post({
          type: 'taskStarted',
          taskId: event.task.id,
          provider: event.task.agentId,
          mode: event.task.mode,
          model: event.task.model,
          enhancedPrompt: event.task.enhancedPrompt,
        });
        break;
      case 'stdout':
        this.post({ type: 'stdout', chunk: event.chunk });
        break;
      case 'stderr':
        this.post({ type: 'stderr', chunk: event.chunk });
        break;
      case 'task_completed':
        this.post({ type: 'taskCompleted', taskId: event.task.id, exitCode: event.result.exitCode });
        break;
      case 'task_stopped':
        this.post({ type: 'taskStopped', taskId: event.task.id });
        break;
      case 'task_error':
        this.post({ type: 'taskError', taskId: event.task.id, message: event.error });
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
        break;
      case 'step_completed':
        this.post({ type: 'stepCompleted', stepLabel: event.stepLabel });
        break;
      case 'step_error':
        this.post({ type: 'stepError', stepLabel: event.stepLabel, error: event.error });
        break;
      case 'activity_started':
        this.post({ type: 'activityStarted', activityKind: event.activityKind, label: event.label });
        break;
      case 'activity_done':
        this.post({ type: 'activityDone', activityKind: event.activityKind, label: event.label, status: event.status });
        break;
      case 'token_usage_updated':
        this.post({
          type: 'tokenUsageUpdated',
          taskId: event.task.id,
          phase: event.phase,
          usage: event.usage,
        });
        break;
      case 'plan_saved':
        this.post({ type: 'planSaved', taskId: event.task.id, planPath: event.planPath });
        break;
    }
  }
}
