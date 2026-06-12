import type { IStreamDecoder, DecodedFrame } from '../../core/stream/IStreamDecoder';

export class PlainTextDecoder implements IStreamDecoder {
  decode(chunk: string): DecodedFrame[] {
    return [{ type: 'raw', data: chunk }];
  }

  flush(): DecodedFrame[] {
    return [];
  }
}
