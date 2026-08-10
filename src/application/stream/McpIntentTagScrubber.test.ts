import { describe, it, expect } from 'vitest';
import { McpIntentTagScrubber } from './McpIntentTagScrubber';

const BLOCK = '<NEXUS_TOOL_INTENT>{"group":"docs","query":"q","reason":"r"}</NEXUS_TOOL_INTENT>';

/** Feeds `text` in fixed-size slices and returns everything released. */
function scrubInChunks(text: string, size: number): string {
  const scrubber = new McpIntentTagScrubber();
  let out = '';
  for (let i = 0; i < text.length; i += size) {
    out += scrubber.push(text.slice(i, i + size));
  }
  return out + scrubber.flush();
}

describe('McpIntentTagScrubber', () => {
  it('passes text through untouched when there is no tag', () => {
    const scrubber = new McpIntentTagScrubber();
    expect(scrubber.push('hello world') + scrubber.flush()).toBe('hello world');
  });

  it('removes a whole block delivered in one chunk', () => {
    const scrubber = new McpIntentTagScrubber();
    const out = scrubber.push(`before ${BLOCK} after`) + scrubber.flush();
    expect(out).toBe('before  after');
    expect(out).not.toContain('NEXUS_TOOL_INTENT');
  });

  it('removes multiple blocks in one stream', () => {
    const scrubber = new McpIntentTagScrubber();
    const out = scrubber.push(`a${BLOCK}b${BLOCK}c`) + scrubber.flush();
    expect(out).toBe('abc');
  });

  // The reason this is stateful at all: real streams split the tag arbitrarily.
  it('removes the block no matter where the chunk boundaries fall', () => {
    const text = `before ${BLOCK} after`;
    for (let size = 1; size <= text.length; size++) {
      expect(scrubInChunks(text, size)).toBe('before  after');
    }
  });

  it('handles a boundary in the middle of the opening tag specifically', () => {
    const scrubber = new McpIntentTagScrubber();
    let out = scrubber.push('answer <NEXUS');
    out += scrubber.push('_TOOL_INT');
    out += scrubber.push('ENT>{"group":"docs"}</NEXUS_TOOL_INTENT>');
    out += scrubber.push(' done');
    out += scrubber.flush();
    expect(out).toBe('answer  done');
  });

  it('does not withhold text that merely resembles the tag', () => {
    const scrubber = new McpIntentTagScrubber();
    expect(scrubber.push('<NOT_A_TAG>keep me</NOT_A_TAG>') + scrubber.flush())
      .toBe('<NOT_A_TAG>keep me</NOT_A_TAG>');
  });

  it('emits text before a tag immediately, without waiting for the close', () => {
    const scrubber = new McpIntentTagScrubber();
    expect(scrubber.push('visible now <NEXUS_TOOL_INTENT>{"a":1}')).toBe('visible now ');
  });

  // Losing the agent's answer would be far worse than showing a stray tag.
  it('releases an unterminated block verbatim at end of stream', () => {
    const scrubber = new McpIntentTagScrubber();
    const out = scrubber.push('text <NEXUS_TOOL_INTENT>{"group":"docs"') + scrubber.flush();
    expect(out).toBe('text <NEXUS_TOOL_INTENT>{"group":"docs"');
  });

  it('releases a dangling partial opening tag at end of stream', () => {
    const scrubber = new McpIntentTagScrubber();
    expect(scrubber.push('trailing <NEXUS_TO') + scrubber.flush()).toBe('trailing <NEXUS_TO');
  });

  it('stops withholding once an unterminated block exceeds the buffer cap', () => {
    const scrubber = new McpIntentTagScrubber();
    let out = scrubber.push('<NEXUS_TOOL_INTENT>');
    out += scrubber.push('x'.repeat(9_000));
    out += scrubber.flush();
    expect(out).toContain('x'.repeat(100));
    expect(out.length).toBeGreaterThan(8_000);
  });

  it('resumes normal pass-through after a block closes', () => {
    const scrubber = new McpIntentTagScrubber();
    let out = scrubber.push(`${BLOCK}first`);
    out += scrubber.push(' second');
    out += scrubber.flush();
    expect(out).toBe('first second');
  });

  it('preserves surrounding text byte-for-byte, including newlines', () => {
    const text = `line one\n\n${BLOCK}\n\nline two`;
    const scrubber = new McpIntentTagScrubber();
    expect(scrubber.push(text) + scrubber.flush()).toBe('line one\n\n\n\nline two');
  });
});
