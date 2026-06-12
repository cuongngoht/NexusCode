import { describe, expect, it, beforeEach } from 'vitest';
import { CodexSseAdapter } from './CodexSseAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';

function sseFrame(data: string, eventType?: string): DecodedFrame {
  return { type: 'sse', data, eventType };
}

function lineFrame(data: string): DecodedFrame {
  return { type: 'line', data };
}

describe('CodexSseAdapter', () => {
  let adapter: CodexSseAdapter;

  beforeEach(() => {
    adapter = new CodexSseAdapter();
  });

  it('emits content_delta for a content chunk', () => {
    const events = adapter.adapt(sseFrame(
      '{"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}'
    ));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'Hi' });
  });

  it('ignores chunks with empty delta.content', () => {
    const events = adapter.adapt(sseFrame(
      '{"choices":[{"delta":{},"finish_reason":null}]}'
    ));
    expect(events).toHaveLength(0);
  });

  it('emits stream_done on [DONE]', () => {
    const events = adapter.adapt(sseFrame('[DONE]'));
    expect(events).toEqual([{ kind: 'stream_done' }]);
  });

  it('emits stream_error (not throw) for malformed JSON', () => {
    const events = adapter.adapt(sseFrame('{broken'));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('stream_error');
  });

  it('returns [] for non-sse frame type', () => {
    expect(adapter.adapt(lineFrame('anything'))).toHaveLength(0);
    expect(adapter.adapt({ type: 'raw', data: 'raw' })).toHaveLength(0);
  });

  it('emits stream_done on finish_reason=stop', () => {
    const events = adapter.adapt(sseFrame(
      '{"choices":[{"delta":{},"finish_reason":"stop"}]}'
    ));
    expect(events).toEqual([{ kind: 'stream_done' }]);
  });

  it('accumulates tool argument fragments and emits tool_call on finish_reason=tool_calls', () => {
    // Frame 1: tool name established
    adapter.adapt(sseFrame(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"read_file","arguments":""}}]},"finish_reason":null}]}'
    ));

    // Frame 2: argument fragment
    adapter.adapt(sseFrame(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"pa"}}]},"finish_reason":null}]}'
    ));

    // Frame 3: final argument fragment + finish_reason
    const events = adapter.adapt(sseFrame(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"th\\":\\"foo\\"}"}}]},"finish_reason":"tool_calls"}]}'
    ));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      kind: 'tool_call',
      toolName: 'read_file',
      toolArgs: '{"pa' + 'th":"foo"}',
    });
  });

  it('[DONE] flushes any pending tool calls before stream_done', () => {
    // Establish a tool call without finish_reason
    adapter.adapt(sseFrame(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"write_file","arguments":"{\\"path\\":\\"x\\"}"}}]},"finish_reason":null}]}'
    ));

    const events = adapter.adapt(sseFrame('[DONE]'));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'tool_call', toolName: 'write_file' });
    expect(events[1]).toEqual({ kind: 'stream_done' });
  });

  it('handles multiple content deltas across frames', () => {
    const e1 = adapter.adapt(sseFrame('{"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}'));
    const e2 = adapter.adapt(sseFrame('{"choices":[{"delta":{"content":"lo"},"finish_reason":null}]}'));

    expect(e1).toEqual([{ kind: 'content_delta', text: 'Hel' }]);
    expect(e2).toEqual([{ kind: 'content_delta', text: 'lo' }]);
  });
});
