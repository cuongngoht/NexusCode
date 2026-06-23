import type { IStreamDecoder, DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { ActivityKind } from '../../core/agent/IOutputParser';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

const TOOL_KIND_MAP: Record<string, ActivityKind> = {
  read_file: 'read', view_file: 'read', list_files: 'read', list_dir: 'read',
  search_files: 'search', search_codebase: 'search', grep: 'search',
  web_search: 'search', web_fetch: 'search',
  write_file: 'write', create_file: 'write',
  edit_file: 'edit', apply_patch: 'edit', str_replace: 'edit',
  run_terminal_cmd: 'bash', execute_command: 'bash', bash: 'bash', shell: 'bash',
  todo_write: 'todo', todo_read: 'todo',
};

function toolKind(name: string): ActivityKind {
  return TOOL_KIND_MAP[name.toLowerCase()] ?? 'tool_call';
}

function extractText(obj: Record<string, unknown>): string | null {
  if (typeof obj.data    === 'string') return obj.data;
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
      .map(c => c.text as string).join('');
    return joined || null;
  }
  return null;
}

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

function toolLabel(name: string, obj: Record<string, unknown>): string {
  const input: Record<string, unknown> =
    (obj.input as Record<string, unknown>) ??
    (obj.args as Record<string, unknown>) ??
    (obj.arguments && typeof obj.arguments === 'string'
      ? (() => { try { return JSON.parse(obj.arguments as string) as Record<string, unknown>; } catch { return {}; } })()
      : (obj.arguments as Record<string, unknown>)) ??
    {};
  const hint =
    (typeof input.path    === 'string' ? input.path    : null) ??
    (typeof input.command === 'string' ? input.command : null) ??
    (typeof input.query   === 'string' ? input.query   : null) ??
    (typeof input.pattern === 'string' ? input.pattern : null) ?? '';
  return hint ? `${name}: ${hint}` : name;
}

export interface GrokToolUsePayload {
  label: string;
  kind: ActivityKind;
}

/**
 * Decodes Grok's streaming-JSON wire format into typed DecodedFrames.
 *
 * Frame types emitted:
 *   'grok.thought'     data: thought text
 *   'grok.text'        data: text token
 *   'grok.tool_use'    data: JSON.stringify(GrokToolUsePayload)
 *   'grok.tool_result' data: '' (current tool completed)
 *   'grok.error'       data: error message
 *   'grok.done'        data: ''
 *   'line'             data: raw non-JSON line (plain-text fallback)
 */
export class GrokJsonLineDecoder implements IStreamDecoder {
  private _buffer = '';

  decode(chunk: string): DecodedFrame[] {
    const combined = this._buffer + chunk;
    const parts = combined.split('\n');
    this._buffer = parts.pop() ?? '';
    return parts
      .filter(l => l.trim().length > 0)
      .map(line => this._parseLine(line));
  }

  flush(): DecodedFrame[] {
    const remaining = this._buffer.trim();
    this._buffer = '';
    if (!remaining) return [];
    return [this._parseLine(remaining)];
  }

  private _parseLine(rawLine: string): DecodedFrame {
    const line = rawLine.replace(ANSI_RE, '').trim();
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const type = typeof obj.type === 'string' ? obj.type : '';

      if (type === 'error') {
        const msg = typeof obj.message === 'string' ? obj.message : line;
        return { type: 'grok.error', data: msg };
      }

      if (type === 'done' || type === 'complete' || type === 'end' || type === 'session_started') {
        return { type: 'grok.done', data: '' };
      }

      const isToolCall = type === 'tool_use' || type === 'function_call' ||
                         type === 'tool_call' || type === 'tool_invocation';
      if (isToolCall) {
        const name = extractToolName(obj);
        if (name) {
          const label = toolLabel(name, obj);
          const kind  = toolKind(name);
          const payload: GrokToolUsePayload = { label, kind };
          return { type: 'grok.tool_use', data: JSON.stringify(payload) };
        }
      }

      const isToolResult = type === 'tool_result' || type === 'function_call_output' ||
                           type === 'tool_output';
      if (isToolResult) {
        return { type: 'grok.tool_result', data: '' };
      }

      if (type === 'thought' || type === 'thinking' || type === 'reasoning') {
        const text = typeof obj.data === 'string' ? obj.data : extractText(obj);
        return { type: 'grok.thought', data: text ?? '' };
      }

      if (type === 'text') {
        const text = typeof obj.data === 'string' ? obj.data : extractText(obj);
        return { type: 'grok.text', data: text ?? '' };
      }

      const text = extractText(obj);
      if (text !== null && text !== '') {
        return { type: 'grok.text', data: text };
      }

      return { type: 'line', data: rawLine };
    } catch {
      return { type: 'line', data: rawLine };
    }
  }
}
