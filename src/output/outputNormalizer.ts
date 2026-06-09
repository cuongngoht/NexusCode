import { ProviderId } from '../core/types';
import { ParsedLine } from './parsers/genericParser';
import { parseGeneric } from './parsers/genericParser';
import { parseCodex } from './parsers/codexParser';
import { parseClaude } from './parsers/claudeParser';
import { parseAntigravity } from './parsers/antigravityParser';

export function normalizeOutput(chunk: string, provider: ProviderId): ParsedLine[] {
  switch (provider) {
    case 'codex':
      return parseCodex(chunk);
    case 'claude':
      return parseClaude(chunk);
    case 'antigravity':
      return parseAntigravity(chunk);
    default:
      return parseGeneric(chunk);
  }
}
