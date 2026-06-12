import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';

interface OpenAiDelta {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

interface OpenAiChunk {
  choices?: Array<{
    delta?: OpenAiDelta;
    finish_reason?: string | null;
  }>;
}

export class CodexSseAdapter implements IProviderStreamAdapter {
  private readonly _pendingToolArgs = new Map<number, { name: string; args: string }>();

  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    if (frame.type !== 'sse') return [];

    const data = frame.data.trim();

    if (data === '[DONE]') {
      const flushed: AgentStreamEvent[] = [];
      for (const [, tool] of this._pendingToolArgs) {
        flushed.push({ kind: 'tool_call', toolName: tool.name, toolArgs: tool.args });
      }
      this._pendingToolArgs.clear();
      flushed.push({ kind: 'stream_done' });
      return flushed;
    }

    let chunk: OpenAiChunk;
    try {
      chunk = JSON.parse(data) as OpenAiChunk;
    } catch {
      return [{ kind: 'stream_error', message: `SSE JSON parse error: ${data.slice(0, 80)}` }];
    }

    const events: AgentStreamEvent[] = [];
    const choices = chunk.choices ?? [];

    for (const choice of choices) {
      const delta = choice.delta;
      if (!delta) continue;

      if (delta.content) {
        events.push({ kind: 'content_delta', text: delta.content });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (tc.function?.name) {
            this._pendingToolArgs.set(idx, {
              name: tc.function.name,
              args: tc.function.arguments ?? '',
            });
          } else if (tc.function?.arguments) {
            const pending = this._pendingToolArgs.get(idx);
            if (pending) {
              pending.args += tc.function.arguments;
            }
          }
        }
      }

      if (choice.finish_reason === 'tool_calls') {
        for (const [, tool] of this._pendingToolArgs) {
          events.push({ kind: 'tool_call', toolName: tool.name, toolArgs: tool.args });
        }
        this._pendingToolArgs.clear();
      } else if (choice.finish_reason === 'stop') {
        events.push({ kind: 'stream_done' });
      }
    }

    return events;
  }
}
