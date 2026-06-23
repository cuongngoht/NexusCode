import { describe, expect, it, beforeEach } from 'vitest';
import { GrokJsonLineDecoder } from './GrokJsonLineDecoder';

describe('GrokJsonLineDecoder', () => {
  let dec: GrokJsonLineDecoder;
  beforeEach(() => { dec = new GrokJsonLineDecoder(); });

  it('emits grok.thought for {"type":"thought"} lines', () => {
    const frames = dec.decode('{"type":"thought","data":"The"}\n');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ type: 'grok.thought', data: 'The' });
  });

  it('emits grok.text for {"type":"text"} lines', () => {
    const frames = dec.decode('{"type":"text","data":"Hello"}\n');
    expect(frames[0]).toMatchObject({ type: 'grok.text', data: 'Hello' });
  });

  it('emits grok.tool_use with label and kind payload', () => {
    const frames = dec.decode('{"type":"tool_use","name":"read_file","input":{"path":"src/foo.ts"}}\n');
    expect(frames[0].type).toBe('grok.tool_use');
    const payload = JSON.parse(frames[0].data);
    expect(payload.label).toBe('read_file: src/foo.ts');
    expect(payload.kind).toBe('read');
  });

  it('emits grok.tool_result for tool_result events', () => {
    const frames = dec.decode('{"type":"tool_result"}\n');
    expect(frames[0]).toMatchObject({ type: 'grok.tool_result', data: '' });
  });

  it('emits grok.error for error events', () => {
    const frames = dec.decode('{"type":"error","message":"oops"}\n');
    expect(frames[0]).toMatchObject({ type: 'grok.error', data: 'oops' });
  });

  it('emits grok.done for done/complete events', () => {
    const frames = dec.decode('{"type":"done"}\n');
    expect(frames[0]).toMatchObject({ type: 'grok.done', data: '' });
  });

  it('emits line frame for non-JSON text', () => {
    const frames = dec.decode('plain text output\n');
    expect(frames[0]).toMatchObject({ type: 'line', data: 'plain text output' });
  });

  it('buffers partial lines across chunks', () => {
    const f1 = dec.decode('{"type":"text","da');
    expect(f1).toHaveLength(0);
    const f2 = dec.decode('ta":"Hi"}\n');
    expect(f2[0]).toMatchObject({ type: 'grok.text', data: 'Hi' });
  });

  it('flush() drains buffered partial line', () => {
    dec.decode('{"type":"text","data":"Hi"}'); // no newline
    const frames = dec.flush();
    expect(frames[0]).toMatchObject({ type: 'grok.text', data: 'Hi' });
  });

  it('strips ANSI before JSON parsing', () => {
    const frames = dec.decode('\x1B[33m{"type":"text","data":"colored"}\x1B[0m\n');
    expect(frames[0]).toMatchObject({ type: 'grok.text', data: 'colored' });
  });
});
