import type { AgentTask, AgentResult, IAgent, TaskMode } from '../../core/agent';
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

/**
 * Idle timeout defaults, in ms — how long the CLI may emit *nothing* before it
 * is treated as hung. Not a total run limit: processRunner resets the timer on
 * every output chunk.
 *
 * Modes that spend long stretches reading and reasoning before they emit
 * anything need much more headroom than a short question does, so the ceiling is
 * per-mode rather than global. These are the fallbacks used when no override
 * resolver is injected (notably the CLI entry point, which has no VS Code
 * settings to read).
 */
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const MODE_IDLE_TIMEOUT_MS: Partial<Record<TaskMode, number>> = {
  // Matches the agent CLI's own --print-timeout of 20m.
  review: 20 * 60 * 1000,
  // Mapping a whole codebase reads dozens of files between emissions.
  understand: 30 * 60 * 1000,
};

/** Resolves a per-mode idle timeout, or undefined to accept the built-in default. */
export type IdleTimeoutResolver = (mode: TaskMode) => number | undefined;

export class RunAgentUseCase {
  private activeTask: AgentTask | null = null;

  constructor(
    private readonly router: AgentRouter,
    private readonly runner: IProcessRunner,
    private readonly eventBus: IEventBus,
    private readonly mcpToolUseCase?: McpToolUseCase,
    private readonly configService?: ConfigService,
    private readonly tokenMeter: TokenMeter = new TokenMeter(),
    /**
     * Injected by the composition root so user settings can override the
     * defaults above. Kept as a callback rather than a config object so this
     * layer never imports the VS Code API, and so a settings change takes effect
     * on the next run without a reload.
     */
    private readonly idleTimeoutResolver?: IdleTimeoutResolver,
  ) { }

  private resolveIdleTimeoutMs(mode: TaskMode): number {
    const override = this.idleTimeoutResolver?.(mode);
    if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
      return override;
    }
    return MODE_IDLE_TIMEOUT_MS[mode] ?? DEFAULT_IDLE_TIMEOUT_MS;
  }

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
    const suppressChat = agent.suppressChatStreamModes?.includes(task.mode) ?? false;

    const inputPrompt = command.inputPrompt ?? task.enhancedPrompt;

    this.activeTask = task;
    task.start();
    this.eventBus.emit({
      kind: 'task_started',
      task,
      enhancedPrompt: task.enhancedPrompt,
      enhancedPromptSections: task.enhancedPromptSections as Array<{ title: string; content: string }> | undefined,
      skillIds: task.skillIds as string[] | undefined,
      mentionedAgentIds: task.mentionedAgentIds as string[] | undefined,
    });
    this.eventBus.emit({
      kind: 'token_usage_updated',
      task,
      phase: 'preview',
      usage: this.tokenMeter.createPreview(task, agent.displayName, inputPrompt),
    });

    try {
      const result = await this.runner.run(command, {
        onStdout: rawChunk => {
          const chunk = agent.transformStdout ? agent.transformStdout(rawChunk) : rawChunk;
          onStdoutCollect?.(chunk);
          if (pipeline) {
            this._emitStreamEvents(task, pipeline.processChunk(chunk), suppressChat);
            return;
          }
          // Always emit the raw chunk as stdout. This guarantees the agent's full output
          // (the "result") reaches the UI message body, history, copy, and context builders
          // regardless of how the (optional) outputParser classifies lines.
          //
          // Dual-path design (intentional):
          //  - New primary path: AgentStreamPipeline + IProviderStreamAdapter (per-provider)
          //    → emits rich typed events (content_delta, reasoning_delta, tool_call/result, etc.).
          //    Adapters live in providers/*/ and are selected via transport in AgentCommand.
          //    See AgentStreamPipelineFactory (now registry-based for OCP) and IProviderStreamAdapter.
          //  - Legacy side-channel: IOutputParser (optional on IAgent) → only produces
          //    activity_* events for UI "progress chips" (read/edit/bash/todo...).
          //    Never used to filter or replace the actual answer content.
          //
          // This separation keeps content fidelity independent of activity extraction.
          // It matches PlainTextAdapter + the original Claude/Codex parsers and prevents
          // review-style or @-mention prose from being diverted entirely into chips.
          this.eventBus.emit({ kind: 'stdout', task, chunk, suppressChat });

          if (!parser) {
            return;
          }
          const activities = parser.parse(chunk);
          for (const act of activities) {
            if (act.kind !== 'plain') {
              if (act.status === 'running') {
                this.eventBus.emit({ kind: 'activity_started', task, activityKind: act.kind, label: act.label });
              } else {
                this.eventBus.emit({ kind: 'activity_done', task, activityKind: act.kind, label: act.label, status: act.status });
              }
            }
            // Note: we no longer collect/filter "plainLines" for a separate stdout emit.
            // The raw chunk above already ensures all content (including what used to be plain)
            // is present. Activities provide compact UI annotations on top.
          }
        },
        onStderr: chunk => this.eventBus.emit({ kind: 'stderr', task, chunk }),
        cwd: task.cwd,
        // Kill the CLI if it produces no output for too long — guards against silent hangs.
        // Per-mode, and overridable via nexus.execution.*.idleTimeoutMs.
        idleTimeoutMs: this.resolveIdleTimeoutMs(task.mode),
      });

      if (pipeline) {
        this._emitStreamEvents(task, pipeline.flush(), suppressChat);
      } else if (parser?.flush) {
        for (const act of parser.flush()) {
          if (act.kind === 'plain') continue;
          if (act.status === 'running') {
            this.eventBus.emit({ kind: 'activity_started', task, activityKind: act.kind, label: act.label });
          } else {
            this.eventBus.emit({ kind: 'activity_done', task, activityKind: act.kind, label: act.label, status: act.status });
          }
        }
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

  private _emitStreamEvents(task: AgentTask, events: AgentStreamEvent[], suppressChat = false): void {
    for (const event of events) {
      switch (event.kind) {
        case 'content_delta':
          this.eventBus.emit({ kind: 'stdout', task, chunk: event.text, suppressChat });
          break;
        case 'reasoning_delta':
          this.eventBus.emit({ kind: 'reasoning', task, chunk: event.text });
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
