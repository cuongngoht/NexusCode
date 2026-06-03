import type { AgentTask } from '../agent/AgentTask';
import type { AgentResult } from '../agent/AgentResult';

export type NexusEvent =
  | { kind: 'task_started'; task: AgentTask }
  | { kind: 'stdout'; task: AgentTask; chunk: string }
  | { kind: 'stderr'; task: AgentTask; chunk: string }
  | { kind: 'task_completed'; task: AgentTask; result: AgentResult }
  | { kind: 'task_stopped'; task: AgentTask }
  | { kind: 'task_error'; task: AgentTask; error: string }
  | { kind: 'step_started'; stepLabel: string; stepIndex: number; totalSteps: number; provider: string; mode: string; model?: string }
  | { kind: 'step_completed'; stepLabel: string }
  | { kind: 'step_error'; stepLabel: string; error: string }
  | { kind: 'summarize_started'; provider: string }
  | { kind: 'summarize_completed'; filesWritten: string[] }
  | { kind: 'summarize_error'; error: string };

export type NexusEventKind = NexusEvent['kind'];

export interface IEventBus {
  emit(event: NexusEvent): void;
  on(kind: NexusEventKind | '*', handler: (event: NexusEvent) => void): void;
  off(kind: NexusEventKind | '*', handler: (event: NexusEvent) => void): void;
}
