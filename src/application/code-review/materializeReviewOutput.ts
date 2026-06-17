import type { AgentId } from '../../core/agent/AgentTask';
import { AgentStreamPipeline } from '../stream/AgentStreamPipeline';
import { LineDecoder } from '../../infrastructure/stream/LineDecoder';
import { GrokStreamAdapter } from '../../providers/grok/GrokStreamAdapter';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';

export interface MaterializeReviewOutputInput {
  stdoutText: string;
  stderrText?: string;
  reasoningText?: string;
  processStdout?: string;
  agentId?: AgentId;
}

function collectStreamText(events: AgentStreamEvent[]): string {
  const parts: string[] = [];
  for (const ev of events) {
    if (ev.kind === 'content_delta' || ev.kind === 'reasoning_delta') {
      parts.push(ev.text);
    } else if (ev.kind === 'stream_error') {
      parts.push(ev.message);
    }
  }
  return parts.join('');
}

/** Decode grok --output-format streaming-json process stdout into reviewable text. */
export function decodeGrokStreamingStdout(raw: string): string {
  if (!raw.trim()) return '';
  const pipeline = new AgentStreamPipeline(new LineDecoder(), new GrokStreamAdapter());
  const events = [...pipeline.processChunk(raw), ...pipeline.flush()];
  const decoded = collectStreamText(events);
  return decoded || raw;
}

function decodeProcessStdout(raw: string, agentId: AgentId | undefined): string {
  if (!raw.trim()) return '';
  if (agentId === 'grok') {
    return decodeGrokStreamingStdout(raw);
  }
  return raw;
}

/**
 * Build the best-effort text blob for CodeReviewResultParser from streamed chunks
 * and optional full process stdout (fallback when stream decoding dropped content).
 */
export function materializeReviewOutput(input: MaterializeReviewOutputInput): string {
  const parts: string[] = [];
  const streamed = [input.stdoutText, input.reasoningText].filter(Boolean).join('');
  if (streamed.trim()) parts.push(streamed);

  const stderr = input.stderrText?.trim();
  if (stderr) parts.push(stderr);

  const decoded = input.processStdout
    ? decodeProcessStdout(input.processStdout, input.agentId)
    : '';

  if (decoded.trim()) {
    const merged = parts.join('\n');
    // Prefer decoded process output when stream capture is empty or shorter (e.g. stderr-only errors).
    if (!merged.trim() || (decoded.length > merged.length && !merged.includes('```json'))) {
      parts.push(decoded);
    } else if (!merged.includes('{') && decoded.includes('{')) {
      parts.push(decoded);
    }
  }

  return parts.join('\n').trim();
}