import type { IStreamDecoder, DecodedFrame } from '../../core/stream/IStreamDecoder';

export class LineDecoder implements IStreamDecoder {
  private _buffer = '';

  decode(chunk: string): DecodedFrame[] {
    const combined = this._buffer + chunk;
    const parts = combined.split('\n');
    this._buffer = parts.pop() ?? '';
    return parts
      .filter(l => l.length > 0)
      .map(data => ({ type: 'line' as const, data }));
  }

  flush(): DecodedFrame[] {
    const remaining = this._buffer.trim();
    this._buffer = '';
    if (remaining.length === 0) return [];
    return [{ type: 'line', data: remaining }];
  }
}
