import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';
import type { ActivityKind } from '../../core/agent/IOutputParser';
import type { GrokToolUsePayload } from './GrokJsonLineDecoder';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

const PHASES: Array<{ re: RegExp; name: string; kind: ActivityKind }> = [
  { re: /\b(plan(ning)?|let me plan)\b/i,                                                             name: 'Planning',        kind: 'todo'   },
  { re: /\b(read(ing)?|load(ing)?|fetch(ing)?|open(ing)?|inspect(ing)?|view(ing)?)\b/i,               name: 'Reading context', kind: 'read'   },
  { re: /\b(edit(ing)?|writ(e|ing)|creat(e|ing)|modif(y|ying|ied)|apply|fix(ing)?|implement(ing)?)\b/i, name: 'Editing files', kind: 'edit' },
  { re: /\b(run(ning)?|test(ing)?|build(ing)?|execut(e|ing)|compil(e|ing)|install(ing)?)\b/i,         name: 'Running tests',   kind: 'bash'   },
  { re: /\b(review(ing)?|analyz(e|ing)|evaluat(e|ing)|check(ing)?)\b/i,                               name: 'Reviewing',       kind: 'search' },
  { re: /\b(summar(y|iz(e|ing))|final|complet(e|ing|ed)|done|result)\b/i,                             name: 'Final summary',   kind: 'plain' as ActivityKind },
];

/**
 * Maps typed DecodedFrames from GrokJsonLineDecoder into AgentStreamEvents.
 * Handles Thinking chip lifecycle (open/close on thought→text transition).
 * No JSON.parse — all structural parsing is done by GrokJsonLineDecoder.
 */
export class GrokEventAdapter implements IProviderStreamAdapter {
  private _currentPhase: string | null = null;
  private _inTextPhase = false;

  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    switch (frame.type) {
      case 'grok.thought':     return this._handleThought(frame.data);
      case 'grok.text':        return this._handleText(frame.data);
      case 'grok.tool_use':    return this._handleToolUse(JSON.parse(frame.data) as GrokToolUsePayload);
      case 'grok.tool_result': return this._handleToolResult();
      case 'grok.error':       return [{ kind: 'stream_error', message: frame.data }];
      case 'grok.done':        return [];
      case 'line':             return this._textEvents(frame.data);
      default:                 return frame.data ? [{ kind: 'content_delta', text: frame.data }] : [];
    }
  }

  flush(): AgentStreamEvent[] {
    if (!this._currentPhase) return [{ kind: 'stream_done' }];
    const name = this._currentPhase;
    this._currentPhase = null;
    return [
      { kind: 'tool_result', toolName: name, status: 'done', toolKind: undefined },
      { kind: 'stream_done' },
    ];
  }

  private _handleThought(text: string): AgentStreamEvent[] {
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

  private _handleText(text: string): AgentStreamEvent[] {
    const events: AgentStreamEvent[] = [];
    if (!this._inTextPhase) {
      this._inTextPhase = true;
      if (this._currentPhase) {
        events.push({ kind: 'tool_result', toolName: this._currentPhase, status: 'done', toolKind: undefined });
        this._currentPhase = null;
      }
    }
    if (text) events.push({ kind: 'content_delta', text });
    return events;
  }

  private _handleToolUse(payload: GrokToolUsePayload): AgentStreamEvent[] {
    const events: AgentStreamEvent[] = [];
    if (this._currentPhase && this._currentPhase !== payload.label) {
      events.push({ kind: 'tool_result', toolName: this._currentPhase, status: 'done', toolKind: undefined });
    }
    this._currentPhase = payload.label;
    this._inTextPhase = false;
    events.push({ kind: 'tool_call', toolName: payload.label, toolArgs: '', toolKind: payload.kind });
    return events;
  }

  private _handleToolResult(): AgentStreamEvent[] {
    if (!this._currentPhase) return [];
    const name = this._currentPhase;
    this._currentPhase = null;
    return [{ kind: 'tool_result', toolName: name, status: 'done', toolKind: undefined }];
  }

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
