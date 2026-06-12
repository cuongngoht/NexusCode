import { describe, expect, it, beforeEach } from 'vitest';
import { LineDecoder } from './LineDecoder';

describe('LineDecoder', () => {
  let decoder: LineDecoder;

  beforeEach(() => {
    decoder = new LineDecoder();
  });

  it('holds a partial line across two chunks', () => {
    const first = decoder.decode('hel');
    expect(first).toHaveLength(0);

    const second = decoder.decode('lo\n');
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ type: 'line', data: 'hello' });
  });

  it('emits multiple complete lines from one chunk', () => {
    const frames = decoder.decode('line1\nline2\nline3\n');
    expect(frames).toHaveLength(3);
    expect(frames.map(f => f.data)).toEqual(['line1', 'line2', 'line3']);
  });

  it('filters blank lines', () => {
    const frames = decoder.decode('\nline1\n\nline2\n');
    expect(frames.map(f => f.data)).toEqual(['line1', 'line2']);
  });

  it('flush() returns the remaining partial line', () => {
    decoder.decode('partial');
    const flushed = decoder.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toMatchObject({ type: 'line', data: 'partial' });
  });

  it('flush() returns empty when nothing is buffered', () => {
    decoder.decode('done\n');
    expect(decoder.flush()).toHaveLength(0);
  });

  it('flush() returns empty after already flushing', () => {
    decoder.decode('partial');
    decoder.flush();
    expect(decoder.flush()).toHaveLength(0);
  });
});
