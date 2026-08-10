/**
 * context7's `query-docs` tool requires a `libraryId` — it is a two-step server:
 * `resolve-library-id` turns a free-text name into a Context7 id, and only then can
 * `query-docs` be called. Nexus previously sent `{ query }` alone, so every context7
 * call failed with:
 *
 *   MCP error -32602: Input validation error: Invalid arguments for tool query-docs:
 *   [{ "path": ["libraryId"], "message": "expected string, received undefined" }]
 *
 * `resolve-library-id` answers with a human-readable listing rather than JSON, e.g.
 *
 *   Available Libraries:
 *
 *   - Title: React
 *   - Context7-compatible library ID: /reactjs/react.dev
 *   - Description: React.dev is the official documentation website…
 *
 * Results are ordered best-match first, so the first id wins.
 */

const LIBRARY_ID_RE = /Context7-compatible library ID:\s*(\S+)/i;

/** Extracts the best-match Context7 library id, or undefined if the listing has none. */
export function parseContext7LibraryId(rawText: string): string | undefined {
  const match = rawText.match(LIBRARY_ID_RE);
  const id = match?.[1]?.trim();
  return id ? id : undefined;
}

/**
 * Best-effort library name from a free-text query, for `resolve-library-id`'s
 * `libraryName` argument. The server treats it as a fuzzy hint, so the first
 * meaningful token is enough; stop-words would only skew the match.
 */
const QUERY_STOP_WORDS = new Set([
  'the', 'a', 'an', 'how', 'to', 'in', 'of', 'for', 'with', 'and', 'or',
  'use', 'using', 'what', 'is', 'are', 'docs', 'documentation', 'api',
]);

export function guessLibraryName(query: string): string {
  const tokens = query
    .split(/[^A-Za-z0-9._@/-]+/)
    .filter(token => token.length > 1 && !QUERY_STOP_WORDS.has(token.toLowerCase()));
  return tokens[0] ?? query.trim();
}
