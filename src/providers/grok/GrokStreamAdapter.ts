import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';
import type { ActivityKind } from '../../core/agent/IOutputParser';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// Map grok tool names → ActivityKind so the UI shows the right icon.
const TOOL_KIND_MAP: Record<string, ActivityKind> = {
  read_file:          'read',
  view_file:          'read',
  list_files:         'read',
  list_dir:           'read',
  search_files:       'search',
  search_codebase:    'search',
  grep:               'search',
  web_search:         'search',
  web_fetch:          'search',
  write_file:         'write',
  create_file:        'write',
  edit_file:          'edit',
  apply_patch:        'edit',
  str_replace:        'edit',
  run_terminal_cmd:   'bash',
  execute_command:    'bash',
  bash:               'bash',
  shell:              'bash',
  todo_write:         'todo',
  todo_read:          'todo',
};

function toolKind(name: string): ActivityKind {
  const lower = name.toLowerCase();
  return TOOL_KIND_MAP[lower] ?? 'tool_call';
}

// Text phases detected from plain-text fallback (non-JSON lines).
const PHASES: Array<{ re: RegExp; name: string; kind: ActivityKind }> = [
  { re: /\b(plan(ning)?|let me plan)\b/i,                                                       name: 'Planning',        kind: 'todo'   },
  { re: /\b(read(ing)?|load(ing)?|fetch(ing)?|open(ing)?|inspect(ing)?|view(ing)?)\b/i,         name: 'Reading context', kind: 'read'   },
  { re: /\b(edit(ing)?|writ(e|ing)|creat(e|ing)|modif(y|ying|ied)|apply|fix(ing)?|implement(ing)?)\b/i, name: 'Editing files', kind: 'edit' },
  { re: /\b(run(ning)?|test(ing)?|build(ing)?|execut(e|ing)|compil(e|ing)|install(ing)?)\b/i,   name: 'Running tests',   kind: 'bash'   },
  { re: /\b(review(ing)?|analyz(e|ing)|evaluat(e|ing)|check(ing)?)\b/i,                         name: 'Reviewing',       kind: 'search' },
  { re: /\b(summar(y|iz(e|ing))|final|complet(e|ing|ed)|done|result)\b/i,                       name: 'Final summary',   kind: 'plain' as ActivityKind },
];

// Extract displayable text from a streaming-json event object.
// Grok streaming-json uses "data" field; other providers use "text"/"content"/"delta.text".
function extractText(obj: Record<string, unknown>): string | null {
  // Grok native streaming-json format
  if (typeof obj.data    === 'string') return obj.data;
  // Generic / Anthropic-style
  if (typeof obj.text    === 'string') return obj.text;
  if (typeof obj.content === 'string') return obj.content;
  if (obj.delta && typeof obj.delta === 'object') {
    const d = obj.delta as Record<string, unknown>;
    if (typeof d.text    === 'string') return d.text;
    if (typeof d.content === 'string') return d.content;
  }
  if (obj.type !== 'error' && typeof obj.message === 'string') return obj.message;
  if (Array.isArray(obj.content)) {
    const joined = (obj.content as Array<Record<string, unknown>>)
      .filter(c => c.type === 'text' && typeof c.text === 'string')
      .map(c => c.text as string)
      .join('');
    return joined || null;
  }
  if (obj.message && typeof obj.message === 'object') {
    const m = obj.message as Record<string, unknown>;
    if (Array.isArray(m.content)) {
      const joined = (m.content as Array<Record<string, unknown>>)
        .filter(c => c.type === 'text' && typeof c.text === 'string')
        .map(c => c.text as string)
        .join('');
      return joined || null;
    }
  }
  return null;
}

// Extract a tool name from a streaming-json tool_use / function_call event.
function extractToolName(obj: Record<string, unknown>): string | null {
  if (typeof obj.name          === 'string') return obj.name;
  if (typeof obj.tool          === 'string') return obj.tool;
  if (typeof obj.tool_name     === 'string') return obj.tool_name;
  if (typeof obj.function_name === 'string') return obj.function_name;
  if (obj.function && typeof obj.function === 'object') {
    const f = obj.function as Record<string, unknown>;
    if (typeof f.name === 'string') return f.name;
  }
  return null;
}

// Build a human-readable label for a tool call: "read_file: src/foo.ts" etc.
function toolLabel(name: string, obj: Record<string, unknown>): string {
  const input: Record<string, unknown> =
    (obj.input  as Record<string, unknown>) ??
    (obj.args   as Record<string, unknown>) ??
    (obj.arguments && typeof obj.arguments === 'string'
      ? (() => { try { return JSON.parse(obj.arguments as string) as Record<string, unknown>; } catch { return {}; } })()
      : (obj.arguments as Record<string, unknown>)) ??
    {};

  const hint =
    (typeof input.path    === 'string' ? input.path    : null) ??
    (typeof input.command === 'string' ? input.command : null) ??
    (typeof input.query   === 'string' ? input.query   : null) ??
    (typeof input.pattern === 'string' ? input.pattern : null) ??
    '';

  return hint ? `${name}: ${hint}` : name;
}

export class GrokStreamAdapter implements IProviderStreamAdapter {
  // Track the active chip name so we can close it when the phase transitions.
  private _currentPhase: string | null = null;
  // Track whether we've transitioned from thought → text phase (to close Thinking chip once).
  private _inTextPhase = false;
  // Buffer partial text tokens until a newline, ensuring code fences (```lang) arrive as
  // a single line. Without this, Grok emits ` `` + `csharp` + `\n` as separate tokens,
  // which the line-based renderer joins as `\n`\n`\ncsharp — breaking markdown fences.
  private _lineBuffer = '';

  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    const rawText = frame.data;
    const line = rawText.trim();
    if (!line) return rawText ? [{ kind: 'content_delta', text: rawText }] : [];

    // ── Parse as streaming-json ──────────────────────────────────────────────
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const type = typeof obj.type === 'string' ? obj.type : '';

      // ── Error events ──────────────────────────────────────────────────────
      if (type === 'error') {
        const msg = typeof obj.message === 'string' ? obj.message : line;
        return [{ kind: 'stream_error', message: msg }];
      }

      // ── Terminal / no-op events ────────────────────────────────────────────
      if (type === 'done' || type === 'complete' || type === 'end' || type === 'session_started') {
        return [];
      }

      // ── Tool call start ────────────────────────────────────────────────────
      const isToolCall =
        type === 'tool_use' ||
        type === 'function_call' ||
        type === 'tool_call' ||
        type === 'tool_invocation';

      if (isToolCall) {
        const name = extractToolName(obj);
        if (name) {
          const label = toolLabel(name, obj);
          const kind  = toolKind(name);
          const events: AgentStreamEvent[] = [];
          if (this._currentPhase && this._currentPhase !== label) {
            events.push({ kind: 'tool_result', toolName: this._currentPhase, status: 'done', toolKind: undefined });
          }
          this._currentPhase = label;
          this._inTextPhase = false;
          events.push({ kind: 'tool_call', toolName: label, toolArgs: '', toolKind: kind });
          return events;
        }
      }

      // ── Tool result / completion ───────────────────────────────────────────
      const isToolResult =
        type === 'tool_result' ||
        type === 'function_call_output' ||
        type === 'tool_output';

      if (isToolResult && this._currentPhase) {
        const events: AgentStreamEvent[] = [
          { kind: 'tool_result', toolName: this._currentPhase, status: 'done', toolKind: undefined },
        ];
        this._currentPhase = null;
        return events;
      }

      // ── Grok thought tokens (streamed one token at a time) ─────────────────
      // Grok streaming-json emits {"type":"thought","data":"word"} for each thinking token.
      // We open a "Thinking" chip on the first token and stream tokens via reasoning_delta
      // (separate channel so they do not pollute the final visible answer).
      if (type === 'thought' || type === 'thinking' || type === 'reasoning') {
        const text = typeof obj.data === 'string' ? obj.data : extractText(obj);
        if (text === null) return [];
        const events: AgentStreamEvent[] = [];
        if (this._currentPhase !== 'Thinking') {
          if (this._currentPhase) {
            events.push({ kind: 'tool_result', toolName: this._currentPhase, status: 'done', toolKind: undefined });
          }
          this._currentPhase = 'Thinking';
          this._inTextPhase = false;
          events.push({ kind: 'tool_call', toolName: 'Thinking', toolArgs: '', toolKind: 'search' });
        }
        if (text) events.push({ kind: 'reasoning_delta', text });
        return events;
      }

      // ── Grok final text tokens (streamed one token at a time) ──────────────
      // Grok streaming-json emits {"type":"text","data":"word"} for each output token.
      // Close the Thinking chip on the first text token (thought→text transition).
      // Buffer tokens until we see \n so that code fences (```lang) arrive as one
      // complete line — the UI joins OutputLines with \n, so each OutputLine must be
      // a logically complete unit (not half of a code-fence marker).
      if (type === 'text') {
        const text = typeof obj.data === 'string' ? obj.data : extractText(obj);
        if (text === null) return [];
        const events: AgentStreamEvent[] = [];
        if (!this._inTextPhase) {
          this._inTextPhase = true;
          if (this._currentPhase) {
            events.push({ kind: 'tool_result', toolName: this._currentPhase, status: 'done', toolKind: undefined });
            this._currentPhase = null;
          }
        }
        if (text) {
          this._lineBuffer += text;
          const lastNl = this._lineBuffer.lastIndexOf('\n');
          if (lastNl !== -1) {
            // Emit everything up to and including the last newline as one delta.
            events.push({ kind: 'content_delta', text: this._lineBuffer.slice(0, lastNl + 1) });
            this._lineBuffer = this._lineBuffer.slice(lastNl + 1);
          } else if (this._lineBuffer.length > 120) {
            // Fallback: flush long lines without newline so streaming feels responsive.
            events.push({ kind: 'content_delta', text: this._lineBuffer });
            this._lineBuffer = '';
          }
        }
        return events;
      }

      // ── Regular text / assistant content (other JSON formats) ─────────────
      const text = extractText(obj);
      if (text === null || text === '') return [];
      // Don't do phase detection on structured JSON text — grok emits explicit
      // thought/text events; other providers emit explicit tool_use events.
      return [{ kind: 'content_delta', text }];

    } catch {
      // ── Not valid JSON — plain-text fallback ──────────────────────────────
      return this._textEvents(rawText);
    }
  }

  flush(): AgentStreamEvent[] {
    const events: AgentStreamEvent[] = [];
    if (this._lineBuffer) {
      events.push({ kind: 'content_delta', text: this._lineBuffer });
      this._lineBuffer = '';
    }
    if (!this._currentPhase) {
      events.push({ kind: 'stream_done' });
      return events;
    }
    const name = this._currentPhase;
    this._currentPhase = null;
    return [
      ...events,
      { kind: 'tool_result', toolName: name, status: 'done', toolKind: undefined },
      { kind: 'stream_done' },
    ];
  }

  // Emit a content_delta, plus a phase chip transition when the text matches a keyword.
  // Only used for non-JSON plain-text fallback.
  private _textEvents(text: string): AgentStreamEvent[] {
    const events: AgentStreamEvent[] = [{ kind: 'content_delta', text }];
    const clean = text.replace(ANSI_RE, '').trim();
    const phase = PHASES.find(p => p.re.test(clean));
    if (phase && phase.name !== this._currentPhase) {
      if (this._currentPhase) {
        events.push({ kind: 'tool_result', toolName: this._currentPhase, status: 'done', toolKind: undefined });
      }
      this._currentPhase = phase.name;
      events.push({ kind: 'tool_call', toolName: phase.name, toolArgs: '', toolKind: phase.kind });
    }
    return events;
  }
}
