import { encode } from 'gpt-tokenizer';

export interface TokenCounter {
  countText(text: string): number;
}

export class GptTokenCounter implements TokenCounter {
  countText(text: string): number {
    if (!text || !text.trim()) return 0;
    return encode(text).length;
  }
}
