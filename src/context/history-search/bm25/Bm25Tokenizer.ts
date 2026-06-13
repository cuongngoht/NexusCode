/**
 * BM25 tokenizer for NexusCode history search.
 *
 * Tokenization strategy:
 * - NFKC normalize, then split on whitespace and most punctuation
 * - CamelCase split: keeps original + each part (e.g. NexusOrchestrator → nexusorchestrator, nexus, orchestrator)
 * - File-path split on '.', '/', '\'
 * - CLI-flag split on '--': --auto-approve → auto, approve, auto-approve
 * - Keeps '@agent' and '#skill' tokens intact, then also yields the bare word
 * - Unicode letters and numbers pass through (Vietnamese works naturally)
 * - Filters tokens shorter than minLen
 */

const UNICODE_ALPHANUM_RE = /[\p{L}\p{N}]/u;

function addParts(results: Set<string>, part: string, minLen: number): void {
  if (!part) return;

  const lower = part.toLowerCase();

  // Add the full lowercased part
  if (lower.length >= minLen && UNICODE_ALPHANUM_RE.test(lower)) {
    results.add(lower);
  }

  // Strip leading @ or # and add the bare token
  let stripped = part;
  if (part.startsWith('@') || part.startsWith('#')) {
    stripped = part.slice(1);
    const sl = stripped.toLowerCase();
    if (sl.length >= minLen && UNICODE_ALPHANUM_RE.test(sl)) {
      results.add(sl);
    }
  }

  // CamelCase split (operate on original before lowercasing for case boundary detection)
  const camelParts = stripped.split(/(?<=[a-z\d])(?=[A-Z])/);
  if (camelParts.length > 1) {
    for (const p of camelParts) {
      const pl = p.toLowerCase();
      if (pl.length >= minLen && UNICODE_ALPHANUM_RE.test(pl)) {
        results.add(pl);
      }
    }
  }

  // Dot split (file extensions, dotted paths)
  const dotParts = stripped.split('.');
  if (dotParts.length > 1) {
    for (const p of dotParts) {
      const pl = p.toLowerCase();
      if (pl.length >= minLen && UNICODE_ALPHANUM_RE.test(pl)) {
        results.add(pl);
        // Recursively handle slash-separated parts within dot segments
        for (const sp of p.split('/')) {
          const spl = sp.toLowerCase();
          if (spl.length >= minLen && UNICODE_ALPHANUM_RE.test(spl)) {
            results.add(spl);
            // Recursively handle dash-separated parts
            for (const dp of sp.split('-').filter(Boolean)) {
              const dpl = dp.toLowerCase();
              if (dpl.length >= minLen && UNICODE_ALPHANUM_RE.test(dpl)) {
                results.add(dpl);
              }
            }
          }
        }
      }
    }
  }

  // Slash split (file paths like src/webview-ui/messages.ts)
  const slashParts = stripped.split('/');
  if (slashParts.length > 1) {
    for (const p of slashParts) {
      const pl = p.toLowerCase();
      if (pl.length >= minLen && UNICODE_ALPHANUM_RE.test(pl)) {
        results.add(pl);
        // Recursively handle dash-separated parts within each slash segment
        const dashSubParts = p.split('-').filter(Boolean);
        if (dashSubParts.length > 1) {
          for (const dp of dashSubParts) {
            const dpl = dp.toLowerCase();
            if (dpl.length >= minLen && UNICODE_ALPHANUM_RE.test(dpl)) {
              results.add(dpl);
            }
          }
          // Keep joined form (e.g., webview-ui)
          const joined = dashSubParts.join('-').toLowerCase();
          if (joined.length >= minLen && UNICODE_ALPHANUM_RE.test(joined)) {
            results.add(joined);
          }
        }
      }
    }
  }

  // Dash split on the stripped part (CLI flags, kebab-case, path segments)
  const dashParts = stripped.replace(/^[-@#]+/, '').split('-').filter(Boolean);
  if (dashParts.length > 1) {
    for (const p of dashParts) {
      const pl = p.toLowerCase();
      if (pl.length >= minLen && UNICODE_ALPHANUM_RE.test(pl)) {
        results.add(pl);
      }
    }
    // Keep joined form (e.g., auto-approve)
    const joined = dashParts.join('-').toLowerCase();
    if (joined.length >= minLen && UNICODE_ALPHANUM_RE.test(joined)) {
      results.add(joined);
    }
  }

  // Underscore split (snake_case)
  const underParts = stripped.split('_').filter(Boolean);
  if (underParts.length > 1) {
    for (const p of underParts) {
      const pl = p.toLowerCase();
      if (pl.length >= minLen && UNICODE_ALPHANUM_RE.test(pl)) {
        results.add(pl);
      }
    }
  }
}

export function tokenize(text: string, minLen = 2): string[] {
  const normalized = text.normalize('NFKC');
  const results = new Set<string>();

  // Split by whitespace and most punctuation — but NOT: @ # / - . _ (coding chars)
  const chunks = normalized.split(/[\s,;()[\]{}<>=!?'"\\|^%*~`+]+/).filter(Boolean);

  for (const chunk of chunks) {
    addParts(results, chunk, minLen);
  }

  // Final filter: must contain at least one unicode letter or digit, and meet minimum length
  return [...results].filter(
    t => t.length >= minLen && UNICODE_ALPHANUM_RE.test(t),
  );
}
