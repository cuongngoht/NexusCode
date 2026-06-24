import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';
import type { IOutputParser } from '../../core/agent/IOutputParser';

/**
 * Bridges a legacy IOutputParser into the IProviderStreamAdapter pipeline.
 * Use with PlainTextDecoder so the parser receives raw chunks (it handles
 * its own line-buffering internally via BaseOutputParser).
 */
export class WrappedParserAdapter implements IProviderStreamAdapter {
  constructor(private readonly parser: IOutputParser) {}

  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    const activities = this.parser.parse(frame.data);
    const events: AgentStreamEvent[] = [{ kind: 'content_delta', text: frame.data }];
    for (const act of activities) {
      if (act.kind === 'plain') continue;
      if (act.status === 'running') {
        events.push({ kind: 'tool_call', toolName: act.label, toolArgs: '', toolKind: act.kind });
      } else {
        events.push({ kind: 'tool_result', toolName: act.label, status: act.status, toolKind: act.kind });
      }
    }
    return events;
  }

  flush(): AgentStreamEvent[] {
    const activities = this.parser.flush?.() ?? [];
    const events: AgentStreamEvent[] = [];
    for (const act of activities) {
      if (act.kind === 'plain') continue;
      if (act.status === 'running') {
        events.push({ kind: 'tool_call', toolName: act.label, toolArgs: '', toolKind: act.kind });
      } else {
        events.push({ kind: 'tool_result', toolName: act.label, status: act.status, toolKind: act.kind });
      }
    }
    events.push({ kind: 'stream_done' });
    return events;
  }
}
