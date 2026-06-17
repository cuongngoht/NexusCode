import type { AgentTask } from '../agent/AgentTask';
import type { AgentResult } from '../agent/AgentResult';
import type { ActivityKind } from '../agent/IOutputParser';
import type { TokenRunUsage } from '../tokens/TokenUsage';

export type NexusEvent =
  | { kind: 'task_started'; task: AgentTask; enhancedPrompt?: string; enhancedPromptSections?: Array<{ title: string; content: string }> }
  | { kind: 'stdout'; task: AgentTask; chunk: string; suppressChat?: boolean }
  | { kind: 'reasoning'; task: AgentTask; chunk: string }
  | { kind: 'stderr'; task: AgentTask; chunk: string }
  | { kind: 'task_completed'; task: AgentTask; result: AgentResult }
  | { kind: 'task_stopped'; task: AgentTask }
  | { kind: 'task_error'; task: AgentTask; error: string }
  | { kind: 'step_started'; stepLabel: string; stepIndex: number; totalSteps: number; provider: string; mode: string; model?: string }
  | { kind: 'step_completed'; stepLabel: string }
  | { kind: 'step_error'; stepLabel: string; error: string }
  | { kind: 'activity_started'; task: AgentTask; activityKind: ActivityKind; label: string }
  | { kind: 'activity_done'; task: AgentTask; activityKind: ActivityKind; label: string; status: 'done' | 'error' }
  | { kind: 'summarize_started'; provider: string }
  | { kind: 'summarize_completed'; filesWritten: string[] }
  | { kind: 'summarize_error'; error: string }
  | {
      kind: 'token_usage_updated';
      task: AgentTask;
      phase: 'preview' | 'final';
      usage: TokenRunUsage;
    }
  | { kind: 'plan_saved'; task: AgentTask; planPath?: string }
  | { kind: 'plan_ready_for_approval'; task: AgentTask; planPath?: string; plan: string; mode: string; model?: string }
  | { kind: 'debug_state_changed'; state: string; message?: string }
  | { kind: 'debug_bm25_results'; results: Array<{ path: string; score: number; reason?: string }> }
  | { kind: 'debug_evidence_found'; evidence: string[] }
  | { kind: 'debug_plan_ready'; plan: unknown; planPath?: string }
  | { kind: 'debug_approval_required'; plan: unknown; planPath?: string }
  | { kind: 'debug_verification_started'; command?: string }
  | { kind: 'debug_verification_completed'; succeeded: boolean; output?: string }
  | { kind: 'debug_summary_ready'; summary: string }
  | { kind: 'subagent_started';   role: string; runId: string; displayName?: string }
  | { kind: 'subagent_completed'; role: string; runId: string; durationMs: number; confidence?: number; findingCount?: number }
  | { kind: 'subagent_failed';    role: string; runId: string; durationMs?: number; error: string };

export type NexusEventKind = NexusEvent['kind'];

export interface IEventBus {
  emit(event: NexusEvent): void;
  on(kind: NexusEventKind | '*', handler: (event: NexusEvent) => void): void;
  off(kind: NexusEventKind | '*', handler: (event: NexusEvent) => void): void;
}
