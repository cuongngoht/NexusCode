import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';
import type { ActivityKind } from '../../core/agent/IOutputParser';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const MD_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
const NL_I_RE = /^I(?:'ll| will)\s+(.+)/i;
const CLI_GT_RE = /^>\s+(.+)/;

const READ_RE   = /\b(read|open|view|inspect|check|look at|examine|load|fetch)\b/i;
const EDIT_RE   = /\b(edit|update|modify|write|create|add|change|fix|implement|apply)\b/i;
const BASH_RE   = /\b(run|execute|compile|build|install|test|launch|start)\b/i;
const SEARCH_RE = /\b(search|grep|find|look for|scan)\b/i;

function classifyKind(text: string): ActivityKind {
  if (READ_RE.test(text))   return 'read';
  if (EDIT_RE.test(text))   return 'edit';
  if (BASH_RE.test(text))   return 'bash';
  if (SEARCH_RE.test(text)) return 'search';
  return 'tool_call';
}

function extractLabel(text: string): string {
  const clean = text.replace(MD_LINK_RE, '$1').replace(/\s+/g, ' ').trim();
  return clean.length > 70 ? clean.slice(0, 67) + '…' : clean;
}

export class AntigravityStreamAdapter implements IProviderStreamAdapter {
  private _currentTool: { name: string; kind: ActivityKind } | null = null;

  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    const rawText = frame.data;
    const line = rawText.replace(ANSI_RE, '').trim();
    const events: AgentStreamEvent[] = [{ kind: 'content_delta', text: rawText }];

    let action: string | null = null;
    let m: RegExpExecArray | null;

    m = NL_I_RE.exec(line);
    if (m) {
      action = m[1];
    } else {
      m = CLI_GT_RE.exec(line);
      if (m) {
        action = m[1];
      }
    }

    if (action) {
      if (this._currentTool) {
        events.push({ kind: 'tool_result', toolName: this._currentTool.name, status: 'done', toolKind: this._currentTool.kind });
      }
      const kind = classifyKind(action);
      const label = extractLabel(action);
      this._currentTool = { name: label, kind };
      events.push({ kind: 'tool_call', toolName: label, toolArgs: '', toolKind: kind });
    }

    return events;
  }

  flush(): AgentStreamEvent[] {
    if (!this._currentTool) return [{ kind: 'stream_done' }];
    const tool = this._currentTool;
    this._currentTool = null;
    return [
      { kind: 'tool_result', toolName: tool.name, status: 'done', toolKind: tool.kind },
      { kind: 'stream_done' },
    ];
  }
}
