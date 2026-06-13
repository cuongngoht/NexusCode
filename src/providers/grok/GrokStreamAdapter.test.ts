import { describe, expect, it, beforeEach } from 'vitest';
import { GrokStreamAdapter } from './GrokStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';

function lineFrame(data: string): DecodedFrame { return { type: 'line', data }; }
function jsonFrame(obj: Record<string, unknown>): DecodedFrame { return lineFrame(JSON.stringify(obj)); }

// ── Grok native streaming-json format (actual wire format) ─────────────────────
describe('GrokStreamAdapter — grok native format (thought/text/end)', () => {
  let a: GrokStreamAdapter;
  beforeEach(() => { a = new GrokStreamAdapter(); });

  it('opens Thinking chip on first thought token', () => {
    const evs = a.adapt(jsonFrame({ type: 'thought', data: 'The' }));
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolName: 'Thinking', toolKind: 'search' });
    expect(evs[1]).toEqual({ kind: 'reasoning_delta', text: 'The' });
  });
  it('no duplicate Thinking chip on subsequent thought tokens', () => {
    a.adapt(jsonFrame({ type: 'thought', data: 'The' }));
    const evs = a.adapt(jsonFrame({ type: 'thought', data: ' user' }));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toEqual({ kind: 'reasoning_delta', text: ' user' });
  });
  it('streams thought tokens as reasoning_delta', () => {
    a.adapt(jsonFrame({ type: 'thought', data: 'The' }));
    a.adapt(jsonFrame({ type: 'thought', data: ' user' }));
    const evs = a.adapt(jsonFrame({ type: 'thought', data: ' wants' }));
    expect(evs).toEqual([{ kind: 'reasoning_delta', text: ' wants' }]);
  });
  it('closes Thinking chip on first text token', () => {
    a.adapt(jsonFrame({ type: 'thought', data: 'thinking...' }));
    const evs = a.adapt(jsonFrame({ type: 'text', data: 'Hi' }));
    expect(evs[0]).toMatchObject({ kind: 'tool_result', toolName: 'Thinking', status: 'done' });
    expect(evs[1]).toEqual({ kind: 'content_delta', text: 'Hi' });
  });
  it('no duplicate Thinking close on subsequent text tokens', () => {
    a.adapt(jsonFrame({ type: 'thought', data: 'thinking...' }));
    a.adapt(jsonFrame({ type: 'text', data: 'Hi' }));
    const evs = a.adapt(jsonFrame({ type: 'text', data: ' there' }));
    expect(evs).toEqual([{ kind: 'content_delta', text: ' there' }]);
  });
  it('text without prior thought emits only content_delta', () => {
    const evs = a.adapt(jsonFrame({ type: 'text', data: 'Hello' }));
    expect(evs).toEqual([{ kind: 'content_delta', text: 'Hello' }]);
  });
  it('end event returns []', () => {
    expect(a.adapt(jsonFrame({ type: 'end', stopReason: 'EndTurn' }))).toHaveLength(0);
  });
  it('error event emits stream_error', () => {
    const evs = a.adapt(jsonFrame({ type: 'error', message: 'agent building failed' }));
    expect(evs).toEqual([{ kind: 'stream_error', message: 'agent building failed' }]);
  });
  it('flush after thought closes Thinking + stream_done', () => {
    a.adapt(jsonFrame({ type: 'thought', data: 'working...' }));
    const evs = a.flush();
    expect(evs[0]).toMatchObject({ kind: 'tool_result', toolName: 'Thinking', status: 'done' });
    expect(evs[1]).toEqual({ kind: 'stream_done' });
  });
  it('flush with no active phase emits only stream_done', () => {
    expect(a.flush()).toEqual([{ kind: 'stream_done' }]);
  });
  it('full thought→text→end cycle', () => {
    // thought phase
    const t1 = a.adapt(jsonFrame({ type: 'thought', data: 'planning' }));
    expect(t1[0]).toMatchObject({ kind: 'tool_call', toolName: 'Thinking' });
    expect(t1[1]).toEqual({ kind: 'reasoning_delta', text: 'planning' });
    // transition to text
    const tx1 = a.adapt(jsonFrame({ type: 'text', data: 'Done' }));
    expect(tx1[0]).toMatchObject({ kind: 'tool_result', toolName: 'Thinking' });
    expect(tx1[1]).toEqual({ kind: 'content_delta', text: 'Done' });
    // more text
    const tx2 = a.adapt(jsonFrame({ type: 'text', data: '!' }));
    expect(tx2).toEqual([{ kind: 'content_delta', text: '!' }]);
    // end
    expect(a.adapt(jsonFrame({ type: 'end', stopReason: 'EndTurn' }))).toHaveLength(0);
    // flush after end
    expect(a.flush()).toEqual([{ kind: 'stream_done' }]);
  });
});

// ── Generic JSON formats (compatibility with other providers) ──────────────────
describe('GrokStreamAdapter — generic JSON text events', () => {
  let a: GrokStreamAdapter;
  beforeEach(() => { a = new GrokStreamAdapter(); });

  it('extracts text from {"text":"..."}', () => {
    expect(a.adapt(jsonFrame({ type: 'content', text: 'Hello' }))).toEqual([{ kind: 'content_delta', text: 'Hello' }]);
  });
  it('extracts text from {"content":"..."}', () => {
    expect(a.adapt(jsonFrame({ type: 'msg', content: 'World' }))).toEqual([{ kind: 'content_delta', text: 'World' }]);
  });
  it('extracts text from {"data":"..."} (grok-style, generic type)', () => {
    expect(a.adapt(jsonFrame({ type: 'chunk', data: 'token' }))).toEqual([{ kind: 'content_delta', text: 'token' }]);
  });
  it('extracts text from {"delta":{"text":"..."}}', () => {
    expect(a.adapt(jsonFrame({ type: 'delta', delta: { text: 'tok' } }))).toEqual([{ kind: 'content_delta', text: 'tok' }]);
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
});

// ── Thinking/reasoning events (generic) ──────────────────────────────────────
describe('GrokStreamAdapter — thinking/reasoning events (generic)', () => {
  let a: GrokStreamAdapter;
  beforeEach(() => { a = new GrokStreamAdapter(); });

  it('thinking type with text field emits chip + reasoning_delta', () => {
    const evs = a.adapt(jsonFrame({ type: 'thinking', text: 'analyzing' }));
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolName: 'Thinking', toolKind: 'search' });
    expect(evs[1]).toEqual({ kind: 'reasoning_delta', text: 'analyzing' });
  });
  it('reasoning type also treated as Thinking', () => {
    const evs = a.adapt(jsonFrame({ type: 'reasoning', text: 'reasoning...' }));
    expect(evs[0]).toMatchObject({ kind: 'tool_call', toolName: 'Thinking' });
  });
  it('no duplicate Thinking chip on repeated thinking events', () => {
    a.adapt(jsonFrame({ type: 'thinking', text: 'step 1' }));
    const evs = a.adapt(jsonFrame({ type: 'thinking', text: 'step 2' }));
    expect(evs).toHaveLength(1);
    expect(evs[0].kind).toBe('reasoning_delta');
  });
});

// ── Explicit tool call events (generic) ──────────────────────────────────────
describe('GrokStreamAdapter — tool call events (generic)', () => {
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
  it('closes Thinking chip before tool_call', () => {
    a.adapt(jsonFrame({ type: 'thought', data: 'planning' }));
    const evs = a.adapt(jsonFrame({ type: 'tool_use', name: 'read_file', input: { path: 'foo.ts' } }));
    expect(evs[0]).toMatchObject({ kind: 'tool_result', toolName: 'Thinking', status: 'done' });
    expect(evs[1]).toMatchObject({ kind: 'tool_call', toolKind: 'read' });
  });
  it('emits tool_result for tool_result event', () => {
    a.adapt(jsonFrame({ type: 'tool_use', name: 'read_file', input: {} }));
    const evs = a.adapt(jsonFrame({ type: 'tool_result', tool_use_id: 'x' }));
    expect(evs[0]).toMatchObject({ kind: 'tool_result', status: 'done' });
  });
  it('ignores tool_result when no current phase', () => {
    expect(a.adapt(jsonFrame({ type: 'tool_result', tool_use_id: 'x' }))).toHaveLength(0);
  });
});

// ── Plain text fallback (non-JSON lines) ──────────────────────────────────────
describe('GrokStreamAdapter — plain text fallback', () => {
  let a: GrokStreamAdapter;
  beforeEach(() => { a = new GrokStreamAdapter(); });

  it('emits content_delta for plain text', () => {
    expect(a.adapt(lineFrame('Hello world'))).toEqual([{ kind: 'content_delta', text: 'Hello world' }]);
  });
  it('returns [] for empty line', () => {
    expect(a.adapt(lineFrame(''))).toHaveLength(0);
  });
  it('emits tool_call for Planning keyword', () => {
    const evs = a.adapt(lineFrame('Planning the solution...'));
    expect(evs[0]).toEqual({ kind: 'content_delta', text: 'Planning the solution...' });
    expect(evs[1]).toMatchObject({ kind: 'tool_call', toolName: 'Planning', toolKind: 'todo' });
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
  it('strips ANSI before phase detection', () => {
    const evs = a.adapt(lineFrame('\x1B[32mPlanning the solution\x1B[0m'));
    expect(evs.some(e => e.kind === 'tool_call' && (e as { toolName: string }).toolName === 'Planning')).toBe(true);
  });
});
