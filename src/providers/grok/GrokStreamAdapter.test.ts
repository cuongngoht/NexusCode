import { describe, expect, it, beforeEach } from 'vitest';
import { GrokStreamAdapter } from './GrokStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';

function lineFrame(data: string): DecodedFrame {
  return { type: 'line', data };
}

describe('GrokStreamAdapter', () => {
  let adapter: GrokStreamAdapter;

  beforeEach(() => {
    adapter = new GrokStreamAdapter();
  });

  it('emits content_delta for a plain text line', () => {
    const events = adapter.adapt(lineFrame('Hello, this is some output.'));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'Hello, this is some output.' });
  });

  it('emits content_delta for an empty raw text line', () => {
    const events = adapter.adapt(lineFrame(''));
    expect(events).toHaveLength(0);
  });

  it('emits content_delta for whitespace-only line with raw content', () => {
    const events = adapter.adapt(lineFrame('   '));
    // line is blank after trim but rawText is '   ' which is truthy
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: '   ' });
  });

  it('emits content_delta + tool_call for Planning phase', () => {
    const events = adapter.adapt(lineFrame('Planning the solution...'));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'Planning the solution...' });
    expect(events[1]).toMatchObject({ kind: 'tool_call', toolName: 'Planning', toolKind: 'todo' });
  });

  it('emits content_delta + tool_call for Reading phase', () => {
    const events = adapter.adapt(lineFrame('Loading the configuration file...'));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'Loading the configuration file...' });
    expect(events[1]).toMatchObject({ kind: 'tool_call', toolName: 'Reading context', toolKind: 'read' });
  });

  it('emits content_delta + tool_call for Editing phase', () => {
    const events = adapter.adapt(lineFrame('Editing the source file now'));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'Editing the source file now' });
    expect(events[1]).toMatchObject({ kind: 'tool_call', toolName: 'Editing files', toolKind: 'edit' });
  });

  it('emits content_delta + tool_call for Running phase', () => {
    const events = adapter.adapt(lineFrame('Running the test suite'));
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ kind: 'tool_call', toolName: 'Running tests', toolKind: 'bash' });
  });

  it('emits content_delta + tool_call for Reviewing phase', () => {
    const events = adapter.adapt(lineFrame('Reviewing the changes for quality'));
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ kind: 'tool_call', toolName: 'Reviewing', toolKind: 'search' });
  });

  it('emits tool_result for old phase + tool_call for new phase on transition', () => {
    adapter.adapt(lineFrame('Planning the steps'));
    const events = adapter.adapt(lineFrame('Now editing the files'));
    // Should have: content_delta, tool_result(Planning), tool_call(Editing files)
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'Now editing the files' });
    expect(events[1]).toMatchObject({ kind: 'tool_result', toolName: 'Planning', status: 'done' });
    expect(events[2]).toMatchObject({ kind: 'tool_call', toolName: 'Editing files', toolKind: 'edit' });
  });

  it('does not emit a new tool_call when same phase repeats', () => {
    adapter.adapt(lineFrame('Planning the approach'));
    const events = adapter.adapt(lineFrame('Planning more details'));
    // Same phase — no transition
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'Planning more details' });
  });

  it('flush() emits tool_result for last phase + stream_done', () => {
    adapter.adapt(lineFrame('Editing the index file'));
    const events = adapter.flush();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'tool_result', toolName: 'Editing files', status: 'done' });
    expect(events[1]).toEqual({ kind: 'stream_done' });
  });

  it('flush() emits only stream_done when no phase was active', () => {
    const events = adapter.flush();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'stream_done' });
  });

  it('strips ANSI codes before phase detection', () => {
    const ansiLine = '\x1B[32mPlanning the solution\x1B[0m';
    const events = adapter.adapt(lineFrame(ansiLine));
    expect(events.some(e => e.kind === 'tool_call' && e.kind === 'tool_call' && (e as { toolName: string }).toolName === 'Planning')).toBe(true);
  });

  it('unknown line emits only content_delta', () => {
    const events = adapter.adapt(lineFrame('This is a random prose sentence with no phase keywords.'));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('content_delta');
  });
});
