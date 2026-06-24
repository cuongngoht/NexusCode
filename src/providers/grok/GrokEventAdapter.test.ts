import { describe, expect, it, beforeEach } from 'vitest';
import { GrokEventAdapter } from './GrokEventAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { GrokToolUsePayload } from './GrokJsonLineDecoder';

function thoughtFrame(data: string): DecodedFrame { return { type: 'grok.thought', data }; }
function textFrame(data: string): DecodedFrame { return { type: 'grok.text', data }; }
function toolUseFrame(label: string, kind = 'read'): DecodedFrame {
  const payload: GrokToolUsePayload = { label, kind: kind as never };
  return { type: 'grok.tool_use', data: JSON.stringify(payload) };
}
function toolResultFrame(): DecodedFrame { return { type: 'grok.tool_result', data: '' }; }
function errorFrame(msg: string): DecodedFrame { return { type: 'grok.error', data: msg }; }
function doneFrame(): DecodedFrame { return { type: 'grok.done', data: '' }; }
function lineFrame(data: string): DecodedFrame { return { type: 'line', data }; }

describe('GrokEventAdapter', () => {
  let adapter: GrokEventAdapter;
  beforeEach(() => { adapter = new GrokEventAdapter(); });

  it('opens Thinking chip on first thought token', () => {
    const evs = adapter.adapt(thoughtFrame('The'));
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolName: 'Thinking', toolKind: 'search' });
    expect(evs[1]).toEqual({ kind: 'reasoning_delta', text: 'The' });
  });

  it('no duplicate Thinking chip on subsequent thought tokens', () => {
    adapter.adapt(thoughtFrame('The'));
    const evs = adapter.adapt(thoughtFrame(' user'));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toEqual({ kind: 'reasoning_delta', text: ' user' });
  });

  it('closes Thinking chip on first text token', () => {
    adapter.adapt(thoughtFrame('The'));
    const evs = adapter.adapt(textFrame('Answer'));
    expect(evs[0]).toMatchObject({ kind: 'tool_result', toolName: 'Thinking', status: 'done' });
    expect(evs[1]).toEqual({ kind: 'content_delta', text: 'Answer' });
  });

  it('no duplicate Thinking close on subsequent text tokens', () => {
    adapter.adapt(thoughtFrame('The'));
    adapter.adapt(textFrame('First'));
    const evs = adapter.adapt(textFrame('Second'));
    expect(evs).toEqual([{ kind: 'content_delta', text: 'Second' }]);
  });

  it('emits tool_call for tool_use frame', () => {
    const evs = adapter.adapt(toolUseFrame('read_file: src/foo.ts', 'read'));
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolName: 'read_file: src/foo.ts', toolKind: 'read' });
  });

  it('closes previous phase when new tool_use arrives', () => {
    adapter.adapt(toolUseFrame('read_file: a.ts', 'read'));
    const evs = adapter.adapt(toolUseFrame('edit_file: b.ts', 'edit'));
    expect(evs[0]).toMatchObject({ kind: 'tool_result', toolName: 'read_file: a.ts', status: 'done' });
    expect(evs[1]).toMatchObject({ kind: 'tool_call', toolName: 'edit_file: b.ts' });
  });

  it('emits tool_result for tool_result frame', () => {
    adapter.adapt(toolUseFrame('read_file: a.ts'));
    const evs = adapter.adapt(toolResultFrame());
    expect(evs[0]).toMatchObject({ kind: 'tool_result', toolName: 'read_file: a.ts', status: 'done' });
  });

  it('emits stream_error for error frame', () => {
    const evs = adapter.adapt(errorFrame('oops'));
    expect(evs[0]).toEqual({ kind: 'stream_error', message: 'oops' });
  });

  it('returns [] for done frame', () => {
    expect(adapter.adapt(doneFrame())).toEqual([]);
  });

  it('emits content_delta for plain line frame', () => {
    const evs = adapter.adapt(lineFrame('plain text'));
    expect(evs[0]).toEqual({ kind: 'content_delta', text: 'plain text' });
  });

  it('flush() closes active phase + stream_done', () => {
    adapter.adapt(thoughtFrame('T'));
    const evs = adapter.flush();
    expect(evs[0]).toMatchObject({ kind: 'tool_result', toolName: 'Thinking', status: 'done' });
    expect(evs[1]).toEqual({ kind: 'stream_done' });
  });

  it('flush() emits only stream_done when no active phase', () => {
    expect(adapter.flush()).toEqual([{ kind: 'stream_done' }]);
  });
});
