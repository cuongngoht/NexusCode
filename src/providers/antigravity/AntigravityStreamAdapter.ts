import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// agy emits these startup banners to stdout (not only stderr); suppress them from the chat view.
const AGY_NOISE_RE = [
  /YOLO mode is enabled/i,
  /All tool calls will be automatically approved/i,
];

// agy logs internal debug state without JSON.stringify, emitting bare [object Object] tokens.
// Strip them from any position in a line so they don't pollute rendered output.
const OBJECT_NOISE_RE = /\[object Object\]/g;

export class AntigravityStreamAdapter implements IProviderStreamAdapter {
  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    const line = frame.data.replace(ANSI_RE, '').trim();
    if (!line || AGY_NOISE_RE.some(re => re.test(line))) return [];
    const cleaned = frame.data.replace(OBJECT_NOISE_RE, '');
    if (!cleaned.replace(ANSI_RE, '').trim()) return [];
    return [{ kind: 'content_delta', text: cleaned }];
  }

  flush(): AgentStreamEvent[] {
    return [{ kind: 'stream_done' }];
  }
}
