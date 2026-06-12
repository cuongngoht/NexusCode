import type { AgentCommand } from '../../core/agent/AgentCommand';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import { AgentStreamPipeline } from './AgentStreamPipeline';
import { SseDecoder } from '../../infrastructure/stream/SseDecoder';
import { LineDecoder } from '../../infrastructure/stream/LineDecoder';
import { PlainTextDecoder } from '../../infrastructure/stream/PlainTextDecoder';
import { CodexSseAdapter } from '../../providers/codex/CodexSseAdapter';
import { CodexJsonlAdapter } from '../../providers/codex/CodexJsonlAdapter';

class PlainTextAdapter implements IProviderStreamAdapter {
  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    const text = frame.data;
    if (text.length === 0) return [];
    return [{ kind: 'content_delta', text }];
  }
}

export class AgentStreamPipelineFactory {
  static create(command: AgentCommand): AgentStreamPipeline | null {
    switch (command.transport) {
      case 'sse':
        return new AgentStreamPipeline(new SseDecoder(), new CodexSseAdapter());
      case 'jsonl':
        return new AgentStreamPipeline(new LineDecoder(), AgentStreamPipelineFactory._pickJsonlAdapter(command.executable));
      case 'plain':
        return new AgentStreamPipeline(new PlainTextDecoder(), new PlainTextAdapter());
      case 'stdio':
        return new AgentStreamPipeline(new LineDecoder(), new PlainTextAdapter());
      case undefined:
        return null;
      default: {
        const _exhaustive: never = command.transport;
        void _exhaustive;
        return null;
      }
    }
  }

  private static _pickJsonlAdapter(executable: string): IProviderStreamAdapter {
    return executable === 'codex' ? new CodexJsonlAdapter() : new PlainTextAdapter();
  }
}
