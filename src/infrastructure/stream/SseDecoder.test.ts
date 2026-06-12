import { describe, expect, it, beforeEach } from 'vitest';
import { SseDecoder } from './SseDecoder';

describe('SseDecoder', () => {
  let decoder: SseDecoder;

  beforeEach(() => {
    decoder = new SseDecoder();
  });

  it('emits nothing from a partial first line', () => {
    const frames = decoder.decode('data: {"choi');
    expect(frames).toHaveLength(0);
  });

  it('emits one frame when the partial line is completed', () => {
    decoder.decode('data: {"choi');
    const frames = decoder.decode('ces":[]}\n\n');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ type: 'sse', data: '{"choices":[]}' });
  });

  it('emits multiple frames from one chunk with two blank-line boundaries', () => {
    const frames = decoder.decode('data: A\n\ndata: B\n\n');
    expect(frames).toHaveLength(2);
    expect(frames[0].data).toBe('A');
    expect(frames[1].data).toBe('B');
  });

  it('captures event: field in eventType', () => {
    const frames = decoder.decode('event: ping\ndata: heartbeat\n\n');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ type: 'sse', eventType: 'ping', data: 'heartbeat' });
  });

  it('joins multi-line data: fields with newline', () => {
    const frames = decoder.decode('data: line1\ndata: line2\n\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe('line1\nline2');
  });

  it('ignores comment lines (colon prefix)', () => {
    const frames = decoder.decode(': keep-alive\ndata: hello\n\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe('hello');
  });

  it('[DONE] passes through as raw data field value', () => {
    const frames = decoder.decode('data: [DONE]\n\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe('[DONE]');
  });

  it('flush() dispatches remaining partial event without trailing blank line', () => {
    decoder.decode('data: partial');
    // No trailing \n\n — only a newline that puts the line in completed state
    decoder.decode('\n');
    const flushed = decoder.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0].data).toBe('partial');
  });

  it('flush() returns empty when nothing buffered', () => {
    expect(decoder.flush()).toHaveLength(0);
  });

  it('handles \\r\\n line endings', () => {
    const frames = decoder.decode('data: hello\r\n\r\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe('hello');
  });

  it('ignores id: and retry: fields without crashing', () => {
    const frames = decoder.decode('id: 42\nretry: 3000\ndata: ok\n\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe('ok');
  });

  it('drops event with no data: lines (event-only)', () => {
    const frames = decoder.decode('event: ping\n\n');
    expect(frames).toHaveLength(0);
  });

  it('handles a realistic multi-chunk OpenAI SSE stream', () => {
    const chunk1 = 'data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}\n\n';
    const chunk2 = 'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":null}]}\n\n';
    const chunk3 = 'data: [DONE]\n\n';

    const f1 = decoder.decode(chunk1);
    const f2 = decoder.decode(chunk2);
    const f3 = decoder.decode(chunk3);

    expect(f1).toHaveLength(1);
    expect(f2).toHaveLength(1);
    expect(f3).toHaveLength(1);
    expect(f3[0].data).toBe('[DONE]');
  });
});
