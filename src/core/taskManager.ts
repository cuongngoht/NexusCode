import { NexusTask, ProviderId, TaskMode } from './types';
import { globalBus } from './eventBus';

export class TaskManager {
  private activeTask: NexusTask | null = null;
  private taskCounter = 0;

  createTask(
    prompt: string,
    enhancedPrompt: string,
    provider: ProviderId,
    mode: TaskMode,
    model?: string,
  ): NexusTask {
    const task: NexusTask = {
      id: `task-${++this.taskCounter}`,
      prompt,
      enhancedPrompt,
      provider,
      mode,
      model,
      startedAt: Date.now(),
    };
    this.activeTask = task;
    globalBus.emit({ kind: 'task_started', taskId: task.id, payload: task });
    return task;
  }

  completeTask(taskId: string, exitCode: number): void {
    if (this.activeTask?.id === taskId) {
      this.activeTask.stoppedAt = Date.now();
      this.activeTask.exitCode = exitCode;
      globalBus.emit({ kind: 'task_completed', taskId, payload: { exitCode } });
      this.activeTask = null;
    }
  }

  stopTask(taskId: string): void {
    if (this.activeTask?.id === taskId) {
      this.activeTask.stoppedAt = Date.now();
      globalBus.emit({ kind: 'task_stopped', taskId });
      this.activeTask = null;
    }
  }

  errorTask(taskId: string, message: string): void {
    if (this.activeTask?.id === taskId) {
      this.activeTask.stoppedAt = Date.now();
      globalBus.emit({ kind: 'task_error', taskId, payload: { message } });
      this.activeTask = null;
    }
  }

  getActiveTask(): NexusTask | null {
    return this.activeTask;
  }

  hasActiveTask(): boolean {
    return this.activeTask !== null;
  }
}
