import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';

// Adapter for `codex exec --json` JSONL events (flag promoted from --experimental-json).
// Schema contract per OpenAI docs: unknown fields and event types may appear in any
// release and MUST be ignored — never crash on unrecognized input.
//
// Event types: thread.started, turn.started, turn.completed, turn.failed,
//              item.started, item.updated, item.completed, error
// Item types:  agent_message, reasoning, command_execution, file_change,
//              mcp_tool_call, web_search, todo_list, error

interface CodexJsonlItem {
  type?: string;
  text?: string;
  command?: string;
  exit_code?: number;
  status?: string;
  changes?: Array<{ path?: string; kind?: string }>;
  server?: string;
  tool?: string;
  query?: string;
  message?: string;
  error?: unknown;
}

interface CodexJsonlEvent {
  type?: string;
  item?: CodexJsonlItem;
  error?: { message?: string };
  message?: string;
}

const LABEL_MAX = 120;

function label(text: string): string {
  return text.length > LABEL_MAX ? text.slice(0, LABEL_MAX - 1) + '…' : text;
}

export class CodexJsonlAdapter implements IProviderStreamAdapter {
  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    if (frame.type !== 'line') return [];

    const data = frame.data.trim();
    // Stray non-JSON lines (CLI warnings, etc.) are not part of the event stream
    if (!data.startsWith('{')) return [];

    let event: CodexJsonlEvent;
    try {
      event = JSON.parse(data) as CodexJsonlEvent;
    } catch {
      return [{ kind: 'stream_error', message: `JSONL parse error: ${data.slice(0, 80)}` }];
    }

    switch (event.type) {
      case 'item.started':
        return this._onItemStarted(event.item);
      case 'item.completed':
        return this._onItemCompleted(event.item);
      case 'turn.completed':
        return [{ kind: 'stream_done' }];
      case 'turn.failed':
        return [{ kind: 'stream_error', message: event.error?.message ?? 'Codex turn failed' }];
      case 'error':
        return [{ kind: 'stream_error', message: event.message ?? 'Codex stream error' }];
      default:
        // thread.started, turn.started, item.updated, unknown future types
        return [];
    }
  }

  private _onItemStarted(item: CodexJsonlItem | undefined): AgentStreamEvent[] {
    if (!item) return [];
    switch (item.type) {
      case 'command_execution':
        return [{ kind: 'tool_call', toolName: label(item.command ?? 'shell'), toolArgs: '', toolKind: 'bash' }];
      case 'mcp_tool_call':
        return [{ kind: 'tool_call', toolName: `${item.server ?? 'mcp'}.${item.tool ?? 'tool'}`, toolArgs: '', toolKind: 'tool_call' }];
      default:
        return [];
    }
  }

  private _onItemCompleted(item: CodexJsonlItem | undefined): AgentStreamEvent[] {
    if (!item) return [];
    switch (item.type) {
      case 'agent_message':
        return item.text ? [{ kind: 'content_delta', text: item.text }] : [];

      case 'command_execution': {
        const failed = item.status === 'failed' || (typeof item.exit_code === 'number' && item.exit_code !== 0);
        return [{ kind: 'tool_result', toolName: label(item.command ?? 'shell'), status: failed ? 'error' : 'done', toolKind: 'bash' }];
      }

      case 'file_change':
        return (item.changes ?? [])
          .filter(c => !!c.path)
          .map(c => ({
            kind: 'tool_result' as const,
            toolName: c.path as string,
            status: 'done' as const,
            toolKind: 'edit' as const,
          }));

      case 'mcp_tool_call': {
        const failed = item.status === 'failed' || !!item.error;
        return [{
          kind: 'tool_result',
          toolName: `${item.server ?? 'mcp'}.${item.tool ?? 'tool'}`,
          status: failed ? 'error' : 'done',
          toolKind: 'tool_call',
        }];
      }

      case 'web_search':
        return item.query
          ? [{ kind: 'tool_result', toolName: label(item.query), status: 'done', toolKind: 'search' }]
          : [];

      case 'error':
        return [{ kind: 'stream_error', message: item.message ?? 'Codex item error' }];

      default:
        // reasoning, todo_list — intentionally not rendered
        return [];
    }
  }
}
