import type { DebugSignal } from '../DebugContext';
import { tokenize } from './Bm25Tokenizer';
import * as path from 'path';

/**
 * Build a deduplicated list of search queries from a debug signal and user prompt.
 * Queries are derived from:
 * - Error codes (TS2345, etc.)
 * - Stack trace file refs (basename)
 * - Command / tool name
 * - Suspected tools
 * - Meaningful tokens from the raw error and user prompt
 */
export function buildDebugQueries(signal: DebugSignal, userPrompt: string): string[] {
  const queries: string[] = [];

  // Raw error tokens (first 500 chars to avoid giant stack traces)
  const rawSnippet = signal.raw.slice(0, 500);
  queries.push(rawSnippet);

  // Error codes from the raw signal
  const errorCodeMatches = signal.raw.match(/\b[A-Z]{1,4}\d{3,6}\b/g) ?? [];
  for (const code of errorCodeMatches) {
    queries.push(code);
  }

  // File references from the signal
  for (const ref of signal.files) {
    // Full relative path
    queries.push(ref.path);
    // Basename without extension
    const base = path.basename(ref.path, path.extname(ref.path));
    if (base) queries.push(base);
  }

  // Command / tool name
  if (signal.command) {
    queries.push(signal.command);
  }

  // Suspected tools
  for (const tool of signal.suspectedTools) {
    queries.push(tool);
  }

  // First meaningful line of user prompt
  const firstLine = userPrompt.split('\n').find(l => l.trim().length > 5);
  if (firstLine) {
    queries.push(firstLine.trim().slice(0, 200));
  }

  // Deduplicate and filter empties
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const q of queries) {
    const key = q.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    // Skip queries that are just whitespace or single char
    const tokens = tokenize(q);
    if (tokens.length === 0) continue;
    seen.add(key);
    deduped.push(q.trim());
  }

  return deduped;
}
