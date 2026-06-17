/**
 * Tokenizer for BM25 index used by debug mode.
 *
 * Rules:
 * - Lowercase all tokens.
 * - Preserve TypeScript/JS error codes like TS2345.
 * - Preserve Rust error codes like E0308.
 * - Preserve C# error codes like CS0103.
 * - Split camelCase and PascalCase.
 * - Split snake_case (Python convention).
 * - Split Rust/Go namespace paths on `::` and `/`.
 * - Split Java/Kotlin/C# dotted class paths.
 * - Split on common delimiters: / . _ - : space.
 * - Detect language-specific error class names.
 * - Preserve file basenames and extension-like tokens.
 * - Drop tokens shorter than 2 chars unless they look like error codes or tool names.
 * - Normalize path separators to forward slash.
 */

// TypeScript/JS error codes: TS2345, CS0103
const ERROR_CODE_RE = /^[A-Z]{1,4}\d{3,6}$/;
// Rust error codes: E0308
const RUST_ERROR_CODE_RE = /^E\d{4}$/;
const TOOL_SHORT = new Set(['ts', 'js', 'go', 'rb', 'py', 'cs', 'rs', 'kt', 'sh', 'cc']);

// Well-known language exception/error class names that should always be preserved
const KNOWN_ERROR_NAMES = new Set([
  // Python
  'modulenotfounderror', 'importerror', 'attributeerror', 'typeerror',
  'valueerror', 'keyerror', 'indentationerror', 'syntaxerror', 'nameerror',
  'runtimeerror', 'oserror', 'ioerror', 'filenotfounderror', 'permissionerror',
  'stopiteration', 'generatorexit', 'overflowerror', 'zerodivisionerror',
  'assertionerror', 'unicodedecodeerror', 'unicodeencodeerror', 'recursionerror',
  'memoryerror', 'notimplementederror',
  // Ruby
  'nomethoderror', 'nameerror', 'loaderror',
  // Go
  'panic', 'goroutine',
  // Java/Kotlin
  'nullpointerexception', 'classcastexception', 'illegalargumentexception',
  'illegalstateexception', 'indexoutofboundsexception', 'arrayindexoutofboundsexception',
  'stackoverflowerror', 'outofmemoryerror', 'noclassdeffounderror',
  'classnotfoundexception', 'arithmeticexception', 'concurrentmodificationexception',
  // C#
  'nullreferenceexception', 'invalidoperationexception', 'argumentnullexception',
  'argumentexception', 'formatexception', 'overflowexception', 'dividebyzeroexception',
  'outofmemoryexception', 'stackoverflowexception',
]);

function splitCamelCase(s: string): string[] {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .map(t => t.toLowerCase())
    .filter(Boolean);
}

/**
 * Pre-process text to handle language-specific path/namespace separators
 * before the main delimiter split.
 */
function normalizeLanguageSpecificSeparators(text: string): string {
  // Rust/C++ namespace separator :: → space
  let out = text.replace(/::/g, ' ');
  // Go module paths (github.com/user/repo/pkg) — keep / as separator (already handled)
  // Java/Kotlin/C# dotted class paths: com.example.ClassName → com example ClassName
  // We do NOT replace all dots (would break file.ext patterns), so only replace
  // sequences that look like fully-qualified class names: lowercase.lowercase.UpperCase
  out = out.replace(/\b([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+)\.([A-Z]\w*)/g, '$1 $2');
  return out;
}

export function tokenize(text: string): string[] {
  // Normalize path separators
  let normalized = text.replace(/\\/g, '/');

  // Apply language-specific separator normalizations
  normalized = normalizeLanguageSpecificSeparators(normalized);

  // Split on delimiters: whitespace / . _ - : ( ) [ ] { } , ; " ' ` < > = ! ? @ # $ % ^ & * + ~ |
  const parts = normalized.split(/[\s/._\-:()[\]{},;"'`<>=!?@#$%^&*+~|]+/);

  const tokens: string[] = [];
  for (const part of parts) {
    if (!part) continue;

    // Preserve TypeScript/C#/generic error codes (TS2345, CS0103, etc.)
    if (ERROR_CODE_RE.test(part)) {
      tokens.push(part.toLowerCase());
      continue;
    }

    // Preserve Rust error codes (E0308, E0502, etc.)
    if (RUST_ERROR_CODE_RE.test(part)) {
      tokens.push(part.toLowerCase());
      continue;
    }

    const lower = part.toLowerCase();

    // Preserve known error/exception class names in full
    if (KNOWN_ERROR_NAMES.has(lower)) {
      tokens.push(lower);
      continue;
    }

    // Split camelCase/PascalCase (handles Java/Kotlin/C# class names)
    const subTokens = splitCamelCase(part);
    for (const t of subTokens) {
      const tLower = t.toLowerCase();
      if (tLower.length < 2) {
        // Keep short tokens that are known tool extensions or error code prefixes
        if (TOOL_SHORT.has(tLower)) {
          tokens.push(tLower);
        }
        continue;
      }
      tokens.push(tLower);
    }
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return tokens.filter(t => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/**
 * Tokenize a file path: extract directory components and basename/stem.
 */
export function tokenizePath(filePath: string): string[] {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const tokens: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    // Stem without extension
    const dotIdx = part.lastIndexOf('.');
    const stem = dotIdx > 0 ? part.slice(0, dotIdx) : part;
    const ext = dotIdx > 0 ? part.slice(dotIdx + 1) : '';
    tokens.push(...tokenize(stem));
    if (ext && ext.length >= 2) tokens.push(ext.toLowerCase());
    tokens.push(part.toLowerCase()); // full filename as one token too
  }
  return [...new Set(tokens)];
}
