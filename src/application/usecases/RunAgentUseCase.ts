import type { AgentTask, AgentResult } from '../../core/agent';
import type { IEventBus } from '../../core/events/IEventBus';
import type { IProcessRunner } from '../../core/runner/IProcessRunner';
import { AgentRouter } from '../AgentRouter';

export class RunAgentUseCase {
  private activeTask: AgentTask | null = null;

  constructor(
    private readonly router: AgentRouter,
    private readonly runner: IProcessRunner,
    private readonly eventBus: IEventBus,
  ) { }

  async execute(task: AgentTask): Promise<AgentResult> {
    const agent = await this.router.resolve(task.agentId, task.mode);
    const command = agent.buildCommand(task);

    this.activeTask = task;
    task.start();
    this.eventBus.emit({ kind: 'task_started', task });

    try {
      const result = await this.runner.run(command, {
        onStdout: chunk => this.eventBus.emit({ kind: 'stdout', task, chunk }),
        onStderr: chunk => this.eventBus.emit({ kind: 'stderr', task, chunk }),
        cwd: task.cwd,
      });

      task.complete(result);
      this.activeTask = null;
      this.eventBus.emit({ kind: 'task_completed', task, result });
      return result;
    } catch (error) {
      task.cancel();
      this.activeTask = null;
      this.eventBus.emit({ kind: 'task_error', task, error: String(error) });
      throw error;
    }
  }

  async stop(): Promise<void> {
    const task = this.activeTask;
    if (!task) return;
    await this.runner.stop();
    task.cancel();
    this.activeTask = null;
    this.eventBus.emit({ kind: 'task_stopped', task });
  }

  hasActiveTask(): boolean {
    return this.activeTask !== null;
  }
}
