import { describe, expect, it } from 'vitest';
import { AgentStreamPipeline } from './AgentStreamPipeline';
import { SseDecoder } from '../../infrastructure/stream/SseDecoder';
import { CodexSseAdapter } from '../../providers/codex/CodexSseAdapter';

describe('AgentStreamPipeline (SSE + Codex end-to-end)', () => {
  function makePipeline() {
    return new AgentStreamPipeline(new SseDecoder(), new CodexSseAdapter());
  }

  it('emits content_delta for each SSE chunk', () => {
    const pipeline = makePipeline();

    const e1 = pipeline.processChunk('data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}\n\n');
    const e2 = pipeline.processChunk('data: {"choices":[{"delta":{"content":"lo"},"finish_reason":null}]}\n\n');

    expect(e1).toEqual([{ kind: 'content_delta', text: 'Hel' }]);
    expect(e2).toEqual([{ kind: 'content_delta', text: 'lo' }]);
  });

  it('emits stream_done on [DONE]', () => {
    const pipeline = makePipeline();
    const events = pipeline.processChunk('data: [DONE]\n\n');
    expect(events).toEqual([{ kind: 'stream_done' }]);
  });

  it('handles mid-JSON split across chunks correctly', () => {
    const pipeline = makePipeline();

    // JSON is split mid-field between chunks
    const e1 = pipeline.processChunk('data: {"choices":[{"delta":{"con');
    expect(e1).toHaveLength(0);  // No complete SSE event yet

    const e2 = pipeline.processChunk('tent":"World"},"finish_reason":null}]}\n\n');
    expect(e2).toEqual([{ kind: 'content_delta', text: 'World' }]);
  });

  it('handles data: line split across chunks (mid SSE line)', () => {
    const pipeline = makePipeline();

    // The chunk boundary is inside the "data: " line itself
    const e1 = pipeline.processChunk('da');
    expect(e1).toHaveLength(0);

    const e2 = pipeline.processChunk('ta: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n\n');
    expect(e2).toEqual([{ kind: 'content_delta', text: 'Hi' }]);
  });

  it('flush() drains remaining partial SSE event after stream close', () => {
    const pipeline = makePipeline();

    // Feed data line without the trailing double-newline (stream closes abruptly)
    pipeline.processChunk('data: {"choices":[{"delta":{"content":"end"},"finish_reason":"stop"}]}\n');

    const flushed = pipeline.flush();
    expect(flushed).toEqual([{ kind: 'content_delta', text: 'end' }, { kind: 'stream_done' }]);
  });

  it('emits stream_error (not throw) for malformed JSON inside SSE data', () => {
    const pipeline = makePipeline();
    const events = pipeline.processChunk('data: {not valid json}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('stream_error');
  });

  it('processes multiple complete SSE events in a single large chunk', () => {
    const pipeline = makePipeline();
    // Each SSE event requires a trailing blank line (\n\n) to be dispatched.
    // The array has an extra '' at the end so join('\n') produces the needed \n\n after [DONE].
    const chunk = [
      'data: {"choices":[{"delta":{"content":"A"},"finish_reason":null}]}',
      '',
      'data: {"choices":[{"delta":{"content":"B"},"finish_reason":null}]}',
      '',
      'data: [DONE]',
      '',
      '',
    ].join('\n');

    const events = pipeline.processChunk(chunk);
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ kind: 'content_delta', text: 'A' });
    expect(events[1]).toEqual({ kind: 'content_delta', text: 'B' });
    expect(events[2]).toEqual({ kind: 'stream_done' });
  });
});
