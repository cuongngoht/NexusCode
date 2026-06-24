export interface DecodedFrame {
  type: string; // well-known: 'line' | 'sse' | 'raw'; providers may add their own (e.g. 'grok.thought')
  eventType?: string;
  data: string;
}

export interface IStreamDecoder {
  decode(chunk: string): DecodedFrame[];
  flush(): DecodedFrame[];
}
