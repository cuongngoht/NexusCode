import type { AgentResult } from './AgentResult';

export type AgentId = 'claude' | 'codex' | 'gemini' | 'copilot' | 'aider' | 'custom' | 'auto';

export type TaskMode =
  | 'ask'
  | 'research'
  | 'scan-project'
  | 'plan'
  | 'edit'
  | 'debug'
  | 'test'
  | 'review';

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
  ) {
    this.id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.startedAt = Date.now();
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
