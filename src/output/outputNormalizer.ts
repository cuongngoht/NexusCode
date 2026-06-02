import { ProviderId } from '../core/types';
import { ParsedLine } from './parsers/genericParser';
import { parseGeneric } from './parsers/genericParser';
import { parseCodex } from './parsers/codexParser';
import { parseClaude } from './parsers/claudeParser';
import { parseGemini } from './parsers/geminiParser';

export function normalizeOutput(chunk: string, provider: ProviderId): ParsedLine[] {
  switch (provider) {
    case 'codex':
      return parseCodex(chunk);
    case 'claude':
      return parseClaude(chunk);
    case 'gemini':
      return parseGemini(chunk);
    default:
      return parseGeneric(chunk);
  }
}
