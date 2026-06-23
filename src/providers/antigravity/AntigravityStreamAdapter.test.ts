import { describe, expect, it, beforeEach } from 'vitest';
import { AntigravityStreamAdapter } from './AntigravityStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';

function lineFrame(data: string): DecodedFrame {
  return { type: 'line', data };
}

describe('AntigravityStreamAdapter', () => {
  let adapter: AntigravityStreamAdapter;

  beforeEach(() => {
    adapter = new AntigravityStreamAdapter();
  });

  it('emits content_delta for plain prose', () => {
    const events = adapter.adapt(lineFrame('This is a regular line of output.'));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'This is a regular line of output.' });
  });

  it('emits content_delta (no activity chips) for narrative lines', () => {
    const events = adapter.adapt(lineFrame("I'll read package.json to see the scripts"));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: "I'll read package.json to see the scripts" });
  });

  it('emits content_delta (no activity chips) for CLI prompt lines', () => {
    const events = adapter.adapt(lineFrame('> npm test'));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: '> npm test' });
  });

  it('preserves raw text including ANSI codes in content_delta', () => {
    const ansiLine = "\x1B[33mSome colored output\x1B[0m";
    const events = adapter.adapt(lineFrame(ansiLine));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: ansiLine });
  });

  it('flush() emits only stream_done', () => {
    const events = adapter.flush();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'stream_done' });
  });

  it('suppresses agy YOLO startup banner from stdout', () => {
    const events = adapter.adapt(lineFrame('YOLO mode is enabled'));
    expect(events).toHaveLength(0);
  });

  it('suppresses "All tool calls will be automatically approved" banner', () => {
    const events = adapter.adapt(lineFrame('All tool calls will be automatically approved'));
    expect(events).toHaveLength(0);
  });

  it('suppresses [object Object] noise lines from agy debug output', () => {
    const events = adapter.adapt(lineFrame('[object Object], input = ,[object Object],;'));
    expect(events).toHaveLength(0);
  });

  it('does not suppress normal lines that happen to contain "object"', () => {
    const events = adapter.adapt(lineFrame('I will read the object definition in types.ts'));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('content_delta');
  });

  it('emits nothing for empty lines after ANSI stripping', () => {
    const events = adapter.adapt(lineFrame('\x1B[0m'));
    expect(events).toHaveLength(0);
  });
});
