import { parseGeneric, ParsedLine } from './genericParser';

export function parseClaude(chunk: string): ParsedLine[] {
  return parseGeneric(chunk);
}
