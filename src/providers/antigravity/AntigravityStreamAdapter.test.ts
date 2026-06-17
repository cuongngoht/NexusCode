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

  it('emits only content_delta for plain prose', () => {
    const events = adapter.adapt(lineFrame('This is a regular line of output.'));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'This is a regular line of output.' });
  });

  it("emits content_delta + tool_call for \"I'll read ...\"", () => {
    const events = adapter.adapt(lineFrame("I'll read package.json to see the scripts"));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ kind: 'content_delta', text: "I'll read package.json to see the scripts" });
    expect(events[1]).toMatchObject({
      kind: 'tool_call',
      toolName: 'read package.json to see the scripts',
      toolKind: 'read',
    });
  });

  it('does not open a tool chip for report narration ("write the report to …")', () => {
    const line =
      "I'll write the comprehensive architecture and code review report to the response.";
    const events = adapter.adapt(lineFrame(line));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'content_delta', text: line });
  });

  it("emits content_delta + tool_call for \"I will edit ...\"", () => {
    const events = adapter.adapt(lineFrame("I will edit the main.ts file"));
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      kind: 'tool_call',
      toolKind: 'edit',
    });
  });

  it('emits content_delta + tool_call for \"> npm test\" command line', () => {
    const events = adapter.adapt(lineFrame('> npm test'));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ kind: 'content_delta', text: '> npm test' });
    expect(events[1]).toMatchObject({
      kind: 'tool_call',
      toolName: 'npm test',
      toolKind: 'bash',
    });
  });

  it('emits content_delta + tool_call for \"> grep ...\" line', () => {
    const events = adapter.adapt(lineFrame('> grep -r "TODO" src/'));
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      kind: 'tool_call',
      toolKind: 'search',
    });
  });

  it('emits tool_result for old tool + tool_call for new on transition', () => {
    adapter.adapt(lineFrame("I'll read the config file"));
    const events = adapter.adapt(lineFrame('> npm install'));
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ kind: 'content_delta', text: '> npm install' });
    expect(events[1]).toMatchObject({ kind: 'tool_result', status: 'done' });
    expect(events[2]).toMatchObject({ kind: 'tool_call', toolKind: 'bash' });
  });

  it('flush() emits tool_result for last tool + stream_done', () => {
    adapter.adapt(lineFrame("I'll read package.json"));
    const events = adapter.flush();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'tool_result', status: 'done' });
    expect(events[1]).toEqual({ kind: 'stream_done' });
  });

  it('flush() emits only stream_done when no tool was active', () => {
    const events = adapter.flush();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'stream_done' });
  });

  it('truncates long labels to 70 chars with ellipsis', () => {
    const longAction = 'I\'ll read ' + 'x'.repeat(80) + ' and process it';
    const events = adapter.adapt(lineFrame(longAction));
    const toolCall = events.find(e => e.kind === 'tool_call');
    expect(toolCall).toBeDefined();
    if (toolCall && toolCall.kind === 'tool_call') {
      expect(toolCall.toolName.length).toBeLessThanOrEqual(70);
      expect(toolCall.toolName.endsWith('…')).toBe(true);
    }
  });

  it('strips markdown links from label', () => {
    const events = adapter.adapt(lineFrame("I'll read [package.json](file:///workspace/package.json)"));
    const toolCall = events.find(e => e.kind === 'tool_call');
    if (toolCall && toolCall.kind === 'tool_call') {
      expect(toolCall.toolName).toContain('package.json');
      expect(toolCall.toolName).not.toContain('file:///');
    }
  });

  it('strips ANSI codes before NL detection', () => {
    const ansiLine = "\x1B[33mI'll run npm install\x1B[0m";
    const events = adapter.adapt(lineFrame(ansiLine));
    expect(events.some(e => e.kind === 'tool_call')).toBe(true);
  });

  it('classifies "I will search for ..." as search kind', () => {
    const events = adapter.adapt(lineFrame('I will search for the bug in the codebase'));
    const toolCall = events.find(e => e.kind === 'tool_call');
    expect(toolCall).toBeDefined();
    if (toolCall && toolCall.kind === 'tool_call') {
      expect(toolCall.toolKind).toBe('search');
    }
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
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].kind).toBe('content_delta');
  });
});
