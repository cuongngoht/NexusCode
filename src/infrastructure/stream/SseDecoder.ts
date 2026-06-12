import type { IStreamDecoder, DecodedFrame } from '../../core/stream/IStreamDecoder';

interface SseEventAccumulator {
  eventType: string | undefined;
  dataLines: string[];
}

export class SseDecoder implements IStreamDecoder {
  private _lineBuffer = '';
  private _event: SseEventAccumulator = { eventType: undefined, dataLines: [] };

  decode(chunk: string): DecodedFrame[] {
    const frames: DecodedFrame[] = [];
    const combined = this._lineBuffer + chunk;
    const lines = combined.split(/\r?\n/);
    this._lineBuffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line === '') {
        const dispatched = this._dispatchEvent();
        if (dispatched) frames.push(dispatched);
        this._event = { eventType: undefined, dataLines: [] };
      } else if (line.startsWith(':')) {
        // SSE comment — ignore
      } else if (line.startsWith('event:')) {
        this._event.eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        this._event.dataLines.push(line.slice(5).trimStart());
      }
      // id:, retry:, and unknown fields are ignored
    }

    return frames;
  }

  flush(): DecodedFrame[] {
    const dispatched = this._dispatchEvent();
    this._event = { eventType: undefined, dataLines: [] };
    return dispatched ? [dispatched] : [];
  }

  private _dispatchEvent(): DecodedFrame | null {
    if (this._event.dataLines.length === 0) return null;
    return {
      type: 'sse',
      eventType: this._event.eventType,
      data: this._event.dataLines.join('\n'),
    };
  }
}
