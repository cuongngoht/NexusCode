import type { AgentTask, AgentResult, IAgent } from '../../core/agent';
import { AgentTask as AgentTaskClass } from '../../core/agent';
import type { IEventBus } from '../../core/events/IEventBus';
import type { IProcessRunner } from '../../core/runner/IProcessRunner';
import { AgentRouter } from '../AgentRouter';
import { TokenMeter } from '../../tokens/TokenMeter';
import type { McpToolUseCase } from '../../mcp/McpToolUseCase';
import type { ConfigService } from '../../config/ConfigService';
import { AgentStreamPipelineFactory } from '../stream/AgentStreamPipelineFactory';
import type { AgentStreamPipeline } from '../stream/AgentStreamPipeline';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';

export class RunAgentUseCase {
  private activeTask: AgentTask | null = null;
  private readonly tokenMeter = new TokenMeter();

  constructor(
    private readonly router: AgentRouter,
    private readonly runner: IProcessRunner,
    private readonly eventBus: IEventBus,
    private readonly mcpToolUseCase?: McpToolUseCase,
    private readonly configService?: ConfigService,
  ) { }

  async execute(task: AgentTask): Promise<AgentResult> {
    const agent = await this.router.resolve(task.agentId, task.mode);
    return this._runWithMcp(task, agent);
  }

  async executeWithAgent(task: AgentTask, agent: IAgent): Promise<AgentResult> {
    return this._runWithMcp(task, agent);
  }

  private async _runWithMcp(task: AgentTask, agent: IAgent): Promise<AgentResult> {
    // First run
    const collectedOutput: string[] = [];
    const result = await this._run(task, agent, chunk => { collectedOutput.push(chunk); });

    // MCP round: only if enabled and configured
    if (!this.mcpToolUseCase || !this.configService) {
      return result;
    }

    let config;
    try {
      config = await this.configService.loadConfig();
    } catch {
      return result;
    }

    if (!config.mcp.enabled) {
      return result;
    }

    const fullOutput = collectedOutput.join('');
    const mcpContext = await this.mcpToolUseCase.tryHandleToolIntent({
      task,
      output: fullOutput,
      config,
    });

    if (!mcpContext) {
      return result;
    }

    // Create follow-up task with MCP context injected
    const followUpTask = this._createFollowUpTaskWithMcpContext(task, mcpContext);
    return this._run(followUpTask, agent);
  }

  private _createFollowUpTaskWithMcpContext(task: AgentTask, mcpContext: string): AgentTask {
    const followUpPrompt = `${task.prompt}\n\n${mcpContext}`;
    const followUpEnhanced = `${task.enhancedPrompt}\n\n${mcpContext}`;
    return new AgentTaskClass(
      followUpPrompt,
      followUpEnhanced,
      task.agentId,
      task.mode,
      task.model,
      task.cwd,
    );
  }

  private async _run(task: AgentTask, agent: IAgent, onStdoutCollect?: (chunk: string) => void): Promise<AgentResult> {
    const command = agent.buildCommand(task);
    const parser = agent.outputParser;
    const pipeline: AgentStreamPipeline | null = AgentStreamPipelineFactory.create(command);

    const inputPrompt = command.inputPrompt ?? task.enhancedPrompt;

    this.activeTask = task;
    task.start();
    this.eventBus.emit({ kind: 'task_started', task, enhancedPrompt: task.enhancedPrompt });
    this.eventBus.emit({
      kind: 'token_usage_updated',
      task,
      phase: 'preview',
      usage: this.tokenMeter.createPreview(task, agent.displayName, inputPrompt),
    });

    try {
      const result = await this.runner.run(command, {
        onStdout: chunk => {
          onStdoutCollect?.(chunk);
          if (pipeline) {
            this._emitStreamEvents(task, pipeline.processChunk(chunk));
            return;
          }
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

      if (pipeline) {
        this._emitStreamEvents(task, pipeline.flush());
      }

      task.complete(result);
      this.activeTask = null;
      this.eventBus.emit({
        kind: 'token_usage_updated',
        task,
        phase: 'final',
        usage: this.tokenMeter.createFinal(task, result, agent.displayName, inputPrompt),
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

  private _emitStreamEvents(task: AgentTask, events: AgentStreamEvent[]): void {
    for (const event of events) {
      switch (event.kind) {
        case 'content_delta':
          this.eventBus.emit({ kind: 'stdout', task, chunk: event.text });
          break;
        case 'tool_call':
          this.eventBus.emit({ kind: 'activity_started', task, activityKind: event.toolKind ?? 'tool_call', label: event.toolName });
          break;
        case 'tool_result':
          this.eventBus.emit({ kind: 'activity_done', task, activityKind: event.toolKind ?? 'tool_call', label: event.toolName, status: event.status });
          break;
        case 'stream_done':
          break;
        case 'stream_error':
          this.eventBus.emit({ kind: 'stderr', task, chunk: `[stream] ${event.message}\n` });
          break;
      }
    }
  }

  async stop(): Promise<void> {
    const task = this.activeTask;
    this.activeTask = null; // clear immediately to prevent double-stop
    if (!task) return; // no-op — no task is running
    await this.runner.stop();
    task.cancel();
    this.eventBus.emit({ kind: 'task_stopped', task });
  }

  hasActiveTask(): boolean {
    return this.activeTask !== null;
  }
}
