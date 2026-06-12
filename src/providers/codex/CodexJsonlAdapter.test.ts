import { describe, expect, it, beforeEach } from 'vitest';
import { CodexJsonlAdapter } from './CodexJsonlAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';

function lineFrame(data: string): DecodedFrame {
  return { type: 'line', data };
}

describe('CodexJsonlAdapter', () => {
  let adapter: CodexJsonlAdapter;

  beforeEach(() => {
    adapter = new CodexJsonlAdapter();
  });

  it('emits content_delta for item.completed agent_message', () => {
    const events = adapter.adapt(lineFrame(
      '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"Here is the answer."}}'
    ));
    expect(events).toEqual([{ kind: 'content_delta', text: 'Here is the answer.' }]);
  });

  it('emits tool_call (bash) for item.started command_execution', () => {
    const events = adapter.adapt(lineFrame(
      '{"type":"item.started","item":{"id":"item_2","type":"command_execution","command":"npm test","status":"in_progress"}}'
    ));
    expect(events).toEqual([{ kind: 'tool_call', toolName: 'npm test', toolArgs: '', toolKind: 'bash' }]);
  });

  it('emits tool_result done for successful command_execution', () => {
    const events = adapter.adapt(lineFrame(
      '{"type":"item.completed","item":{"id":"item_2","type":"command_execution","command":"npm test","exit_code":0,"status":"completed"}}'
    ));
    expect(events).toEqual([{ kind: 'tool_result', toolName: 'npm test', status: 'done', toolKind: 'bash' }]);
  });

  it('emits tool_result error for failed command_execution (non-zero exit)', () => {
    const events = adapter.adapt(lineFrame(
      '{"type":"item.completed","item":{"type":"command_execution","command":"npm test","exit_code":1,"status":"failed"}}'
    ));
    expect(events).toEqual([{ kind: 'tool_result', toolName: 'npm test', status: 'error', toolKind: 'bash' }]);
  });

  it('emits one tool_result (edit) per file in file_change', () => {
    const events = adapter.adapt(lineFrame(
      '{"type":"item.completed","item":{"type":"file_change","changes":[{"path":"src/a.ts","kind":"edit"},{"path":"src/b.ts","kind":"add"}]}}'
    ));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'tool_result', toolName: 'src/a.ts', toolKind: 'edit' });
    expect(events[1]).toMatchObject({ kind: 'tool_result', toolName: 'src/b.ts', toolKind: 'edit' });
  });

  it('emits tool_call/tool_result for mcp_tool_call lifecycle', () => {
    const started = adapter.adapt(lineFrame(
      '{"type":"item.started","item":{"type":"mcp_tool_call","server":"github","tool":"create_issue"}}'
    ));
    expect(started).toEqual([{ kind: 'tool_call', toolName: 'github.create_issue', toolArgs: '', toolKind: 'tool_call' }]);

    const completed = adapter.adapt(lineFrame(
      '{"type":"item.completed","item":{"type":"mcp_tool_call","server":"github","tool":"create_issue","status":"completed"}}'
    ));
    expect(completed).toEqual([{ kind: 'tool_result', toolName: 'github.create_issue', status: 'done', toolKind: 'tool_call' }]);
  });

  it('emits tool_result (search) for web_search', () => {
    const events = adapter.adapt(lineFrame(
      '{"type":"item.completed","item":{"type":"web_search","query":"vitest mock timers"}}'
    ));
    expect(events).toEqual([{ kind: 'tool_result', toolName: 'vitest mock timers', status: 'done', toolKind: 'search' }]);
  });

  it('emits stream_done for turn.completed', () => {
    const events = adapter.adapt(lineFrame(
      '{"type":"turn.completed","usage":{"input_tokens":4547,"cached_input_tokens":2432,"output_tokens":8}}'
    ));
    expect(events).toEqual([{ kind: 'stream_done' }]);
  });

  it('emits stream_error for turn.failed with error message', () => {
    const events = adapter.adapt(lineFrame(
      '{"type":"turn.failed","error":{"message":"rate limit exceeded"}}'
    ));
    expect(events).toEqual([{ kind: 'stream_error', message: 'rate limit exceeded' }]);
  });

  it('ignores lifecycle events that carry no renderable content', () => {
    expect(adapter.adapt(lineFrame('{"type":"thread.started","thread_id":"abc"}'))).toHaveLength(0);
    expect(adapter.adapt(lineFrame('{"type":"turn.started"}'))).toHaveLength(0);
    expect(adapter.adapt(lineFrame('{"type":"item.completed","item":{"type":"reasoning","text":"thinking..."}}'))).toHaveLength(0);
  });

  it('ignores unknown future event and item types (forward compat)', () => {
    expect(adapter.adapt(lineFrame('{"type":"session.checkpoint","data":{}}'))).toHaveLength(0);
    expect(adapter.adapt(lineFrame('{"type":"item.completed","item":{"type":"hologram_render"}}'))).toHaveLength(0);
  });

  it('ignores stray non-JSON lines (CLI warnings)', () => {
    expect(adapter.adapt(lineFrame('warning: something unrelated'))).toHaveLength(0);
  });

  it('emits stream_error (not throw) for malformed JSON starting with {', () => {
    const events = adapter.adapt(lineFrame('{"type":"item.comp'));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('stream_error');
  });

  it('returns [] for non-line frame types', () => {
    expect(adapter.adapt({ type: 'sse', data: '{"type":"turn.completed"}' })).toHaveLength(0);
    expect(adapter.adapt({ type: 'raw', data: '{"type":"turn.completed"}' })).toHaveLength(0);
  });

  it('truncates very long command labels', () => {
    const longCmd = 'x'.repeat(300);
    const events = adapter.adapt(lineFrame(
      JSON.stringify({ type: 'item.started', item: { type: 'command_execution', command: longCmd } })
    ));
    expect(events).toHaveLength(1);
    const e = events[0] as { kind: string; toolName: string };
    expect(e.toolName.length).toBeLessThanOrEqual(120);
  });
});
