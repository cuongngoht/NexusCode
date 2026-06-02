import { parseGeneric, ParsedLine } from './genericParser';

export function parseCodex(chunk: string): ParsedLine[] {
  return parseGeneric(chunk);
}
