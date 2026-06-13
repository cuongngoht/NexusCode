import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';
import type { ActivityKind } from '../../core/agent/IOutputParser';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

const PHASES: Array<{ re: RegExp; name: string; kind: ActivityKind }> = [
  { re: /\b(plan(ning)?|let me plan)\b/i,                                    name: 'Planning',        kind: 'todo'   },
  { re: /\b(read(ing)?|load(ing)?|fetch(ing)?|open(ing)?|inspect(ing)?|view(ing)?)\b/i, name: 'Reading context', kind: 'read'   },
  { re: /\b(edit(ing)?|writ(e|ing)|creat(e|ing)|modif(y|ying|ied)|apply|fix(ing)?|implement(ing)?)\b/i, name: 'Editing files', kind: 'edit' },
  { re: /\b(run(ning)?|test(ing)?|build(ing)?|execut(e|ing)|compil(e|ing)|install(ing)?)\b/i, name: 'Running tests', kind: 'bash' },
  { re: /\b(review(ing)?|analyz(e|ing)|evaluat(e|ing)|check(ing)?)\b/i,     name: 'Reviewing',       kind: 'search' },
  { re: /\b(summar(y|iz(e|ing))|final|complet(e|ing|ed)|done|result)\b/i,   name: 'Final summary',   kind: 'plain' as ActivityKind },
];

export class GrokStreamAdapter implements IProviderStreamAdapter {
  private _currentPhase: string | null = null;

  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    const rawText = frame.data;
    const line = rawText.replace(ANSI_RE, '').trim();
    if (!line) return rawText ? [{ kind: 'content_delta', text: rawText }] : [];

    const events: AgentStreamEvent[] = [{ kind: 'content_delta', text: rawText }];

    const phase = PHASES.find(p => p.re.test(line));
    if (phase && phase.name !== this._currentPhase) {
      if (this._currentPhase) {
        events.push({ kind: 'tool_result', toolName: this._currentPhase, status: 'done', toolKind: undefined });
      }
      this._currentPhase = phase.name;
      events.push({ kind: 'tool_call', toolName: phase.name, toolArgs: '', toolKind: phase.kind });
    }

    return events;
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
}
