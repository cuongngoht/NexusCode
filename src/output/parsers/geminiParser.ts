import { parseGeneric, ParsedLine } from './genericParser';

export function parseGemini(chunk: string): ParsedLine[] {
  return parseGeneric(chunk);
}
