import { describe, expect, it, beforeEach } from 'vitest';
import { GrokStreamAdapter } from './GrokStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';

function lineFrame(data: string): DecodedFrame { return { type: 'line', data }; }
function jsonFrame(obj: Record<string, unknown>): DecodedFrame { return lineFrame(JSON.stringify(obj)); }

describe('GrokStreamAdapter — plain text fallback', () => {
  let a: GrokStreamAdapter;
  beforeEach(() => { a = new GrokStreamAdapter(); });

  it('emits content_delta for plain text', () => {
    expect(a.adapt(lineFrame('Hello world'))).toEqual([{ kind: 'content_delta', text: 'Hello world' }]);
  });
  it('returns [] for empty line', () => {
    expect(a.adapt(lineFrame(''))).toHaveLength(0);
  });
  it('emits content_delta for whitespace-only raw', () => {
    expect(a.adapt(lineFrame('   '))).toEqual([{ kind: 'content_delta', text: '   ' }]);
  });
  it('emits tool_call for Planning keyword', () => {
    const evs = a.adapt(lineFrame('Planning the solution...'));
    expect(evs[0]).toEqual({ kind: 'content_delta', text: 'Planning the solution...' });
    expect(evs[1]).toMatchObject({ kind: 'tool_call', toolName: 'Planning', toolKind: 'todo' });
  });
  it('emits tool_call for Reading keyword', () => {
    const evs = a.adapt(lineFrame('Loading config...'));
    expect(evs[1]).toMatchObject({ kind: 'tool_call', toolName: 'Reading context', toolKind: 'read' });
  });
  it('emits tool_call for Editing keyword', () => {
    const evs = a.adapt(lineFrame('Editing the file'));
    expect(evs[1]).toMatchObject({ kind: 'tool_call', toolName: 'Editing files', toolKind: 'edit' });
  });
  it('transitions phase: emits tool_result for old + tool_call for new', () => {
    a.adapt(lineFrame('Planning the steps'));
    const evs = a.adapt(lineFrame('Now editing the files'));
    expect(evs[1]).toMatchObject({ kind: 'tool_result', toolName: 'Planning', status: 'done' });
    expect(evs[2]).toMatchObject({ kind: 'tool_call', toolName: 'Editing files' });
  });
  it('no duplicate tool_call for same phase', () => {
    a.adapt(lineFrame('Planning the approach'));
    const evs = a.adapt(lineFrame('Planning more details'));
    expect(evs).toHaveLength(1);
    expect(evs[0].kind).toBe('content_delta');
  });
  it('flush emits tool_result + stream_done', () => {
    a.adapt(lineFrame('Editing the index file'));
    const evs = a.flush();
    expect(evs[0]).toMatchObject({ kind: 'tool_result', toolName: 'Editing files', status: 'done' });
    expect(evs[1]).toEqual({ kind: 'stream_done' });
  });
  it('flush emits only stream_done when no phase active', () => {
    expect(a.flush()).toEqual([{ kind: 'stream_done' }]);
  });
  it('strips ANSI before phase detection', () => {
    const evs = a.adapt(lineFrame('\x1B[32mPlanning the solution\x1B[0m'));
    expect(evs.some(e => e.kind === 'tool_call' && (e as { toolName: string }).toolName === 'Planning')).toBe(true);
  });
});

describe('GrokStreamAdapter — streaming-json text events', () => {
  let a: GrokStreamAdapter;
  beforeEach(() => { a = new GrokStreamAdapter(); });

  it('extracts text from {"text":"..."}', () => {
    expect(a.adapt(jsonFrame({ type: 'content', text: 'Hello' }))).toEqual([{ kind: 'content_delta', text: 'Hello' }]);
  });
  it('extracts text from {"content":"..."}', () => {
    expect(a.adapt(jsonFrame({ type: 'msg', content: 'World' }))).toEqual([{ kind: 'content_delta', text: 'World' }]);
  });
  it('extracts text from {"delta":{"text":"..."}}', () => {
    expect(a.adapt(jsonFrame({ type: 'delta', delta: { text: 'token' } }))).toEqual([{ kind: 'content_delta', text: 'token' }]);
  });
  it('extracts text from Anthropic content array', () => {
    const evs = a.adapt(jsonFrame({ type: 'assistant', content: [{ type: 'text', text: 'Hi' }, { type: 'text', text: '!' }] }));
    expect(evs[0]).toEqual({ kind: 'content_delta', text: 'Hi!' });
  });
  it('emits stream_error for error events', () => {
    expect(a.adapt(jsonFrame({ type: 'error', message: 'oops' }))).toEqual([{ kind: 'stream_error', message: 'oops' }]);
  });
  it('returns [] for done/complete/end/session_started', () => {
    for (const t of ['done', 'complete', 'end', 'session_started']) {
      expect(a.adapt(jsonFrame({ type: t }))).toHaveLength(0);
    }
  });
  it('returns [] for JSON with no extractable text', () => {
    expect(a.adapt(jsonFrame({ type: 'metadata', session_id: 'abc' }))).toHaveLength(0);
  });
  it('detects phase keyword in JSON text', () => {
    const evs = a.adapt(jsonFrame({ type: 'content', text: 'Planning the solution' }));
    expect(evs[1]).toMatchObject({ kind: 'tool_call', toolName: 'Planning', toolKind: 'todo' });
  });
});

describe('GrokStreamAdapter — tool call events', () => {
  let a: GrokStreamAdapter;
  beforeEach(() => { a = new GrokStreamAdapter(); });

  it('emits tool_call for tool_use event', () => {
    const evs = a.adapt(jsonFrame({ type: 'tool_use', name: 'read_file', input: { path: 'src/foo.ts' } }));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolName: 'read_file: src/foo.ts', toolKind: 'read' });
  });
  it('emits tool_call for function_call event', () => {
    const evs = a.adapt(jsonFrame({ type: 'function_call', name: 'write_file', input: { path: 'out.ts' } }));
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolName: 'write_file: out.ts', toolKind: 'write' });
  });
  it('emits tool_call for edit_file with correct kind', () => {
    const evs = a.adapt(jsonFrame({ type: 'tool_use', name: 'edit_file', input: { path: 'src/bar.ts' } }));
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolKind: 'edit' });
  });
  it('emits tool_call for run_terminal_cmd with bash kind', () => {
    const evs = a.adapt(jsonFrame({ type: 'tool_use', name: 'run_terminal_cmd', input: { command: 'npm test' } }));
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolName: 'run_terminal_cmd: npm test', toolKind: 'bash' });
  });
  it('emits tool_call for web_search with search kind', () => {
    const evs = a.adapt(jsonFrame({ type: 'tool_use', name: 'web_search', input: { query: 'typescript generics' } }));
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolKind: 'search' });
  });
  it('closes previous phase before opening tool_call', () => {
    a.adapt(jsonFrame({ type: 'content', text: 'Planning the approach' }));
    const evs = a.adapt(jsonFrame({ type: 'tool_use', name: 'read_file', input: { path: 'foo.ts' } }));
    expect(evs[0]).toMatchObject({ kind: 'tool_result', toolName: 'Planning', status: 'done' });
    expect(evs[1]).toMatchObject({ kind: 'tool_call', toolKind: 'read' });
  });
  it('emits tool_result for tool_result event', () => {
    a.adapt(jsonFrame({ type: 'tool_use', name: 'read_file', input: {} }));
    const evs = a.adapt(jsonFrame({ type: 'tool_result', tool_use_id: 'x' }));
    expect(evs[0]).toMatchObject({ kind: 'tool_result', status: 'done' });
  });
  it('ignores tool_result when no current phase', () => {
    const evs = a.adapt(jsonFrame({ type: 'tool_result', tool_use_id: 'x' }));
    expect(evs).toHaveLength(0);
  });
});

describe('GrokStreamAdapter — thinking/reasoning events', () => {
  let a: GrokStreamAdapter;
  beforeEach(() => { a = new GrokStreamAdapter(); });

  it('emits content_delta + Thinking chip for thinking event', () => {
    const evs = a.adapt(jsonFrame({ type: 'thinking', text: 'I need to read the file first' }));
    expect(evs[0]).toEqual({ kind: 'content_delta', text: 'I need to read the file first' });
    expect(evs[1]).toMatchObject({ kind: 'tool_call', toolName: 'Thinking', toolKind: 'search' });
  });
  it('no duplicate Thinking chip on repeated thinking events', () => {
    a.adapt(jsonFrame({ type: 'thinking', text: 'step 1' }));
    const evs = a.adapt(jsonFrame({ type: 'thinking', text: 'step 2' }));
    expect(evs).toHaveLength(1);
    expect(evs[0].kind).toBe('content_delta');
  });
  it('reasoning type also treated as Thinking', () => {
    const evs = a.adapt(jsonFrame({ type: 'reasoning', text: 'analyzing...' }));
    expect(evs.some(e => e.kind === 'tool_call' && (e as { toolName: string }).toolName === 'Thinking')).toBe(true);
  });
});
