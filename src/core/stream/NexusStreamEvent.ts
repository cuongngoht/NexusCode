export type NexusStreamEvent =
  | { kind: 'task.started';   taskId: string; timestamp: number; provider: string; mode: string; model?: string }
  | { kind: 'task.completed'; taskId: string; timestamp: number; provider: string; mode: string; model?: string; exitCode: number }
  | { kind: 'task.failed';    taskId: string; timestamp: number; provider: string; mode: string; model?: string; error: string }
  | { kind: 'step.started';   taskId: string; timestamp: number; provider: string; mode: string; model?: string; label: string; index: number; total: number }
  | { kind: 'step.delta';     taskId: string; timestamp: number; provider: string; mode: string; model?: string; text: string }
  | { kind: 'step.reasoning'; taskId: string; timestamp: number; provider: string; mode: string; model?: string; text: string }
  | { kind: 'step.completed'; taskId: string; timestamp: number; provider: string; mode: string; model?: string; label: string }
  | { kind: 'tool.started';   taskId: string; timestamp: number; provider: string; mode: string; model?: string; toolName: string; toolKind?: string }
  | { kind: 'tool.completed'; taskId: string; timestamp: number; provider: string; mode: string; model?: string; toolName: string; status: 'done' | 'error' }
  | { kind: 'file.changed';   taskId: string; timestamp: number; provider: string; mode: string; model?: string; path: string; changeType: 'modified' | 'added' | 'deleted' }
  | { kind: 'diff.ready';     taskId: string; timestamp: number; provider: string; mode: string; model?: string; path: string; diff: string }
  | { kind: 'token.usage';    taskId: string; timestamp: number; provider: string; mode: string; model?: string; phase: 'preview' | 'final'; inputTokens: number; outputTokens: number; cost?: number }
  | { kind: 'provider.raw';   taskId: string; timestamp: number; provider: string; mode: string; model?: string; chunk: string; stream: 'stdout' | 'stderr' }
  | { kind: 'stream.warning'; taskId: string; timestamp: number; provider: string; mode: string; model?: string; message: string };
