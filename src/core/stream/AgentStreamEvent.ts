export type AgentStreamEvent =
  | { kind: 'content_delta'; text: string }
  | { kind: 'tool_call'; toolName: string; toolArgs: string }
  | { kind: 'tool_result'; toolName: string; status: 'done' | 'error' }
  | { kind: 'stream_done' }
  | { kind: 'stream_error'; message: string };
