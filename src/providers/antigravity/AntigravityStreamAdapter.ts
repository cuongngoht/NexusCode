import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { DecodedFrame } from '../../core/stream/IStreamDecoder';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// agy emits these startup banners to stdout (not only stderr); suppress them from the chat view.
// Also suppress lines that are pure JavaScript object noise ([object Object]) which appear when
// agy logs internal debug state without JSON.stringify.
const AGY_NOISE_RE = [
  /YOLO mode is enabled/i,
  /All tool calls will be automatically approved/i,
  /^\[object Object\]/,
];

export class AntigravityStreamAdapter implements IProviderStreamAdapter {
  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    const line = frame.data.replace(ANSI_RE, '').trim();
    if (!line || AGY_NOISE_RE.some(re => re.test(line))) return [];
    return [{ kind: 'content_delta', text: frame.data }];
  }

  flush(): AgentStreamEvent[] {
    return [{ kind: 'stream_done' }];
  }
}
