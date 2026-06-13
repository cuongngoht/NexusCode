/**
 * Language detector for debug mode.
 *
 * Detects the primary programming language of an error or project from:
 * - File extensions found in stack traces / error messages
 * - Error message patterns (e.g. Python Traceback, Rust error[E0XXX])
 * - Project manifest files present in the workspace root
 * - Shebang lines
 *
 * Pure TypeScript — no external dependencies, no filesystem I/O beyond
 * the optional workspaceRoot check (callers may pass undefined).
 */

export type DetectedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'kotlin'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'cpp'
  | 'c'
  | 'shell'
  | 'unknown';

// ---------------------------------------------------------------------------
// Extension → language mapping
// ---------------------------------------------------------------------------

const EXT_LANG_MAP: Record<string, DetectedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.scala': 'java',
  '.cs': 'csharp',
  '.vb': 'csharp',
  '.fs': 'csharp',
  '.rb': 'ruby',
  '.rake': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
};

// ---------------------------------------------------------------------------
// Error-message pattern → language
// ---------------------------------------------------------------------------

interface LangPattern {
  language: DetectedLanguage;
  pattern: RegExp;
}

const ERROR_PATTERNS: LangPattern[] = [
  // TypeScript
  { language: 'typescript', pattern: /\bTS\d{4}\b/ },
  { language: 'typescript', pattern: /Type '.*?' is not assignable/ },
  { language: 'typescript', pattern: /Object is possibly 'null'|Object is of type 'unknown'/ },
  { language: 'typescript', pattern: /\.tsx?\(\d+,\d+\):\s+error/ },

  // Python
  { language: 'python', pattern: /Traceback \(most recent call last\):/ },
  { language: 'python', pattern: /\bModuleNotFoundError\b/ },
  { language: 'python', pattern: /\bImportError\b/ },
  { language: 'python', pattern: /\bAttributeError\b/ },
  { language: 'python', pattern: /\bIndentationError\b/ },
  { language: 'python', pattern: /\bNameError\b/ },
  { language: 'python', pattern: /\bValueError\b/ },
  { language: 'python', pattern: /\bKeyError\b/ },
  { language: 'python', pattern: /\bTypeError\b.*\.py/ },
  { language: 'python', pattern: /File ".*\.py", line \d+/ },
  { language: 'python', pattern: /\bpytest\b|\bpytest-/ },

  // Rust
  { language: 'rust', pattern: /\berror\[E\d{4}\]/ },
  { language: 'rust', pattern: /\berror\[E0\d{3}\]/ },
  { language: 'rust', pattern: /^\s*-->\s+.*\.rs:\d+:\d+/m },
  { language: 'rust', pattern: /\bcargo\s+(build|test|check|clippy)\b/ },
  { language: 'rust', pattern: /\bthe borrow checker\b|\bborrow of moved value\b/ },

  // Go
  { language: 'go', pattern: /goroutine \d+ \[/ },
  { language: 'go', pattern: /\bpanic:\s+/ },
  { language: 'go', pattern: /\.go:\d+:\d+:/ },
  { language: 'go', pattern: /\bgo (build|test|vet)\b/ },
  { language: 'go', pattern: /\bundefined:\s+\w/ },

  // Java
  { language: 'java', pattern: /Exception in thread "[^"]*"/ },
  { language: 'java', pattern: /\tat [a-z][\w$.]+\([A-Z]\w+\.java:\d+\)/ },
  { language: 'java', pattern: /\bjava\.lang\.\w+Exception\b/ },
  { language: 'java', pattern: /\bcompilation failed|BUILD FAILURE\b/ },
  { language: 'java', pattern: /\bmvn\b|\bgradle\b|\bgradlew\b/ },

  // Kotlin
  { language: 'kotlin', pattern: /\tat [a-z][\w$.]+\([A-Z]\w+\.kt:\d+\)/ },
  { language: 'kotlin', pattern: /\berror: unresolved reference\b/ },
  { language: 'kotlin', pattern: /kotlin\.TypeCastException\b/ },

  // C#
  { language: 'csharp', pattern: /\bCS\d{4}\b/ },
  { language: 'csharp', pattern: /\bdotnet\s+(build|test|run)\b/ },
  { language: 'csharp', pattern: /Build FAILED\.|Error\(s\) in/i },
  { language: 'csharp', pattern: /\bSystem\.\w+Exception\b/ },
  { language: 'csharp', pattern: /\.cs\(\d+,\d+\):/ },

  // Ruby
  { language: 'ruby', pattern: /\bNoMethodError\b/ },
  { language: 'ruby', pattern: /\bNameError\b.*\.rb/ },
  { language: 'ruby', pattern: /\bLoadError\b/ },
  { language: 'ruby', pattern: /\.rb:\d+:in `/ },
  { language: 'ruby', pattern: /\bbundle exec\s+(rspec|rake)\b/ },
  { language: 'ruby', pattern: /\bRSpec\b|\bRspec\b/ },

  // PHP
  { language: 'php', pattern: /\bPHP (Fatal|Parse|Warning) error:/ },
  { language: 'php', pattern: /\bStack trace:\b.*#\d+/ },
  { language: 'php', pattern: /\.php on line \d+/ },
  { language: 'php', pattern: /\bphpunit\b|\bPHPUnit\b/ },

  // Swift
  { language: 'swift', pattern: /\berror:\s+cannot\s+(convert|find)\s+type\b/ },
  { language: 'swift', pattern: /\.swift:\d+:\d+:\s+error:/ },
  { language: 'swift', pattern: /\bswift (build|test|package)\b/ },

  // C/C++
  { language: 'cpp', pattern: /\berror:\s+.*\.cpp:\d+/ },
  { language: 'cpp', pattern: /\bsegmentation fault\b/i },
  { language: 'cpp', pattern: /\bcmake\b.*error|CMakeError/i },
  { language: 'c', pattern: /\berror:\s+.*\.c:\d+/ },
  { language: 'c', pattern: /\bcc1\b|gcc:\s+error\b/i },

  // Shell
  { language: 'shell', pattern: /\bbash:\s+\S+:\s+command not found\b/i },
  { language: 'shell', pattern: /\bsh:\s+\d+:\s+Syntax error\b/i },
  { language: 'shell', pattern: /line \d+:\s+\S+:\s+not found\b/ },
];

// ---------------------------------------------------------------------------
// Manifest file → language (used when checking workspace root)
// ---------------------------------------------------------------------------

export const MANIFEST_LANG_MAP: Array<{ file: string; language: DetectedLanguage }> = [
  { file: 'tsconfig.json', language: 'typescript' },
  { file: 'package.json', language: 'javascript' },
  { file: 'pyproject.toml', language: 'python' },
  { file: 'requirements.txt', language: 'python' },
  { file: 'setup.py', language: 'python' },
  { file: 'setup.cfg', language: 'python' },
  { file: 'Pipfile', language: 'python' },
  { file: 'poetry.lock', language: 'python' },
  { file: 'Cargo.toml', language: 'rust' },
  { file: 'go.mod', language: 'go' },
  { file: 'pom.xml', language: 'java' },
  { file: 'build.gradle', language: 'java' },
  { file: 'build.gradle.kts', language: 'kotlin' },
  { file: 'gradlew', language: 'java' },
  { file: 'mvnw', language: 'java' },
  { file: 'Gemfile', language: 'ruby' },
  { file: 'composer.json', language: 'php' },
  { file: 'Package.swift', language: 'swift' },
  { file: 'CMakeLists.txt', language: 'cpp' },
  { file: 'Makefile', language: 'c' },
];

// ---------------------------------------------------------------------------
// Generic file-reference regex (multi-language)
// ---------------------------------------------------------------------------

// Matches "path/to/file.ext:line" or "path/to/file.ext"
const GENERIC_FILE_REF_RE =
  /[\w./-]+\.(py|rb|go|rs|java|kt|cs|php|swift|cpp|cc|cxx|c|sh|bash)\b/gi;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LanguageDetectionResult {
  language: DetectedLanguage;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Detect language from raw error/prompt text.
 * Does not perform any filesystem I/O.
 */
export function detectLanguageFromText(raw: string): LanguageDetectionResult {
  // 1. Count language votes from error patterns
  const votes = new Map<DetectedLanguage, number>();

  for (const { language, pattern } of ERROR_PATTERNS) {
    if (pattern.test(raw)) {
      votes.set(language, (votes.get(language) ?? 0) + 1);
    }
  }

  // 2. Count file extension references
  const extMatches = raw.match(GENERIC_FILE_REF_RE);
  if (extMatches) {
    for (const match of extMatches) {
      const ext = '.' + match.split('.').pop()!.toLowerCase();
      const lang = EXT_LANG_MAP[ext];
      if (lang) {
        votes.set(lang, (votes.get(lang) ?? 0) + 1);
      }
    }
  }

  if (votes.size === 0) {
    return { language: 'unknown', confidence: 'low', reason: 'No language signals found in text' };
  }

  // Pick highest-vote language
  let bestLang: DetectedLanguage = 'unknown';
  let bestCount = 0;
  for (const [lang, count] of votes) {
    if (count > bestCount) {
      bestCount = count;
      bestLang = lang;
    }
  }

  const confidence = bestCount >= 3 ? 'high' : bestCount >= 2 ? 'medium' : 'low';
  return {
    language: bestLang,
    confidence,
    reason: `Detected ${bestLang} from ${bestCount} signal(s) in error text`,
  };
}

/**
 * Detect language from a list of manifest filenames present in the workspace.
 * The caller supplies the file list — no FS I/O here.
 */
export function detectLanguageFromManifests(
  presentFiles: string[],
): LanguageDetectionResult {
  const lower = presentFiles.map(f => f.toLowerCase());

  for (const { file, language } of MANIFEST_LANG_MAP) {
    if (lower.includes(file.toLowerCase())) {
      return {
        language,
        confidence: 'high',
        reason: `Detected ${language} from manifest file: ${file}`,
      };
    }
  }

  return { language: 'unknown', confidence: 'low', reason: 'No known manifest files found' };
}

/**
 * Combine text-based and manifest-based detection.
 * Text signals take priority if confidence is medium or high;
 * otherwise fall back to manifest detection.
 */
export function detectLanguage(
  raw: string,
  presentManifests: string[] = [],
): LanguageDetectionResult {
  const fromText = detectLanguageFromText(raw);
  if (fromText.language !== 'unknown' && fromText.confidence !== 'low') {
    return fromText;
  }

  const fromManifest = detectLanguageFromManifests(presentManifests);
  if (fromManifest.language !== 'unknown') {
    return fromManifest;
  }

  // Fall back to low-confidence text result
  return fromText;
}
