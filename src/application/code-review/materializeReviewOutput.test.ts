import { describe, it, expect } from 'vitest';
import { decodeGrokStreamingStdout, materializeReviewOutput } from './materializeReviewOutput';

describe('materializeReviewOutput', () => {
  it('decodes grok streaming-json lines into text', () => {
    const raw = [
      '{"type":"text","data":"Hello "}',
      '{"type":"text","data":"world"}',
    ].join('\n');
    expect(decodeGrokStreamingStdout(raw)).toBe('Hello world');
  });

  it('falls back to process stdout when stream capture is empty', () => {
    const processStdout = '{"type":"text","data":"```json\\n{\\"summary\\":\\"ok\\"}\\n```"}';
    const out = materializeReviewOutput({
      stdoutText: '',
      processStdout,
      agentId: 'grok',
    });
    expect(out).toContain('```json');
  });
});