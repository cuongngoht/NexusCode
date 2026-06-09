import { parseGeneric, ParsedLine } from './genericParser';

export function parseAntigravity(chunk: string): ParsedLine[] {
  return parseGeneric(chunk);
}
