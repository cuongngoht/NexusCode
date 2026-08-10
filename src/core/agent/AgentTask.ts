import type { AgentResult } from './AgentResult';

export type AgentId = 'nexus' | 'claude' | 'codex' | 'antigravity' | 'copilot' | 'aider' | 'custom' | 'grok' | 'auto';

export type TaskMode =
  | 'ask'
  | 'research'
  | 'scan-project'
  | 'understand'
  | 'plan'
  | 'brainstorm'
  | 'edit'
  | 'debug'
  | 'test'
  | 'review'
  | 'agent';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export class AgentTask {
  readonly id: string;
  readonly startedAt: number;
  private _status: TaskStatus = 'pending';
  private _result?: AgentResult;

  constructor(
    readonly prompt: string,
    readonly enhancedPrompt: string,
    readonly agentId: AgentId,
    readonly mode: TaskMode,
    readonly model?: string,
    readonly cwd?: string,
    readonly skillIds?: ReadonlyArray<string>,
    readonly mentionedAgentIds?: ReadonlyArray<string>,
    readonly enhancedPromptSections?: ReadonlyArray<{ title: string; content: string }>,
  ) {
    this.id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.startedAt = Date.now();
  }

  /**
   * Same task, new prompt — for MCP follow-up rounds.
   *
   * Preserves `id` and `startedAt` on purpose. A dozen listeners filter events with
   * `event.task.id === task.id` (the review report parser, agent-mode text collectors,
   * git status, file intelligence), and the webview keys its streaming assistant
   * message off the id too. Minting a fresh id for round 2 would strand all of them on
   * round 1's output — which is just the bare intent tag.
   */
  withEnhancedPrompt(enhancedPrompt: string): AgentTask {
    const next = new AgentTask(
      this.prompt,
      enhancedPrompt,
      this.agentId,
      this.mode,
      this.model,
      this.cwd,
      this.skillIds,
      this.mentionedAgentIds,
      this.enhancedPromptSections,
    );
    // Writing through the readonly surface from inside the class: the whole point of
    // this factory is to carry identity across rounds.
    (next as { id: string }).id = this.id;
    (next as { startedAt: number }).startedAt = this.startedAt;
    return next;
  }

  get status(): TaskStatus { return this._status; }
  get result(): AgentResult | undefined { return this._result; }

  start(): void { this._status = 'running'; }
  cancel(): void { this._status = 'cancelled'; }

  complete(result: AgentResult): void {
    this._result = result;
    this._status = result.succeeded ? 'completed' : 'failed';
  }
}
