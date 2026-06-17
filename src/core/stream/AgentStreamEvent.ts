import type { ActivityKind } from '../agent/IOutputParser';

export type AgentStreamEvent =
  | { kind: 'content_delta'; text: string }
  | { kind: 'reasoning_delta'; text: string }
  | { kind: 'tool_call'; toolName: string; toolArgs: string; toolKind?: ActivityKind }
  | { kind: 'tool_result'; toolName: string; status: 'done' | 'error'; toolKind?: ActivityKind }
  | { kind: 'stream_done' }
  | { kind: 'stream_error'; message: string };
