export interface DecodedFrame {
  type: 'line' | 'sse' | 'raw';
  eventType?: string;
  data: string;
}

export interface IStreamDecoder {
  decode(chunk: string): DecodedFrame[];
  flush(): DecodedFrame[];
}
