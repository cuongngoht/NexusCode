/**
 * Condenses the full project map into a knowledge-base-sized digest.
 *
 * The map itself is too large for a knowledge-base entry and wrong-shaped for
 * how the KB is retrieved (BM25 over episodic task records). But an entry with
 * no content at all makes the journal useless for "what do we know about this
 * project?", so an understand run contributes a digest instead: the headline
 * sections, capped, with the full map left on disk.
 */

const DEFAULT_MAX_CHARS = 1200;

/** Sections worth carrying into the journal, most valuable first. */
const DIGEST_SECTIONS = ['What this project is', 'Stack', 'Gotchas'] as const;

/** Extracts a `## <heading>` section body from the map, if present. */
function extractSection(markdown: string, heading: string): string | undefined {
  const lines = markdown.split('\n');
  const start = lines.findIndex(
    line => line.trim().toLowerCase() === `## ${heading}`.toLowerCase(),
  );
  if (start === -1) return undefined;

  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) break;
    body.push(lines[i]);
  }

  const text = body.join('\n').trim();
  return text || undefined;
}

/**
 * Builds the digest. Returns undefined when the map has nothing usable, so
 * callers can omit the field rather than write an empty summary.
 */
export function buildUnderstandingDigest(
  markdown: string,
  maxChars: number = DEFAULT_MAX_CHARS,
): string | undefined {
  const parts: string[] = [];

  for (const heading of DIGEST_SECTIONS) {
    const body = extractSection(markdown, heading);
    if (body) parts.push(`${heading}: ${body}`);
  }

  // No recognisable sections — the model may have used a different structure,
  // so fall back to the top of the document rather than losing the run entirely.
  if (parts.length === 0) {
    const fallback = markdown
      .split('\n')
      .filter(line => !line.startsWith('#') && line.trim() !== '')
      .join('\n')
      .trim();
    if (!fallback) return undefined;
    parts.push(fallback);
  }

  const digest = parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!digest) return undefined;

  return digest.length > maxChars
    ? digest.slice(0, maxChars).trimEnd() + '…'
    : digest;
}

/** Pulls the "Top risks"/"Gotchas" bullets into the entry's nextSteps field. */
export function buildUnderstandingNextSteps(markdown: string, max = 5): string[] | undefined {
  const section = extractSection(markdown, 'Gotchas') ?? extractSection(markdown, 'Top risks');
  if (!section) return undefined;

  const bullets = section
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^([-*]|\d+\.)\s+/.test(line))
    .map(line => line.replace(/^([-*]|\d+\.)\s+/, '').trim())
    .filter(Boolean)
    .slice(0, max);

  return bullets.length > 0 ? bullets : undefined;
}
