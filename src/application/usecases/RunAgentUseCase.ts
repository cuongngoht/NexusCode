import type { AgentTask, AgentResult } from '../../core/agent';
import type { IEventBus } from '../../core/events/IEventBus';
import type { IProcessRunner } from '../../core/runner/IProcessRunner';
import { AgentRouter } from '../AgentRouter';
import { TokenMeter } from '../../tokens/TokenMeter';

export class RunAgentUseCase {
  private activeTask: AgentTask | null = null;
  private readonly tokenMeter = new TokenMeter();

  constructor(
    private readonly router: AgentRouter,
    private readonly runner: IProcessRunner,
    private readonly eventBus: IEventBus,
  ) { }

  async execute(task: AgentTask): Promise<AgentResult> {
    const agent = await this.router.resolve(task.agentId, task.mode);
    const command = agent.buildCommand(task);
    const parser = agent.outputParser;

    this.activeTask = task;
    task.start();
    this.eventBus.emit({ kind: 'task_started', task });
    this.eventBus.emit({
      kind: 'token_usage_updated',
      task,
      phase: 'preview',
      usage: this.tokenMeter.createPreview(task, agent.displayName),
    });

    try {
      const result = await this.runner.run(command, {
        onStdout: chunk => {
          if (!parser) {
            this.eventBus.emit({ kind: 'stdout', task, chunk });
            return;
          }
          const activities = parser.parse(chunk);
          const plainLines: string[] = [];
          for (const act of activities) {
            if (act.kind === 'plain') {
              plainLines.push(act.raw);
            } else if (act.status === 'running') {
              this.eventBus.emit({ kind: 'activity_started', task, activityKind: act.kind, label: act.label });
            } else {
              this.eventBus.emit({ kind: 'activity_done', task, activityKind: act.kind, label: act.label, status: act.status });
            }
          }
          if (plainLines.length > 0) {
            this.eventBus.emit({ kind: 'stdout', task, chunk: plainLines.join('\n') });
          }
        },
        onStderr: chunk => this.eventBus.emit({ kind: 'stderr', task, chunk }),
        cwd: task.cwd,
      });

      task.complete(result);
      this.activeTask = null;
      this.eventBus.emit({
        kind: 'token_usage_updated',
        task,
        phase: 'final',
        usage: this.tokenMeter.createFinal(task, result, agent.displayName),
      });
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
