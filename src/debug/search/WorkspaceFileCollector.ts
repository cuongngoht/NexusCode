import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_INCLUDE_EXTENSIONS = new Set([
  // TypeScript / JavaScript
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  // Python
  '.py', '.pyi',
  // Rust
  '.rs',
  // Go
  '.go',
  // Java / Kotlin / Scala
  '.java', '.kt', '.kts', '.scala',
  // C# / VB / F#
  '.cs', '.vb', '.fs',
  // Ruby
  '.rb', '.rake',
  // PHP
  '.php',
  // Swift
  '.swift',
  // C / C++
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
  // Shell
  '.sh', '.bash', '.zsh', '.fish',
  // Config / Build
  '.json', '.yaml', '.yml', '.toml', '.xml', '.gradle',
  '.lock',
  // Docs
  '.md', '.txt',
  // CSS
  '.css', '.scss', '.sass', '.less',
]);

const DEFAULT_EXCLUDE_DIRS = new Set([
  // JS/TS
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  'coverage',
  'media/webview',
  '__MACOSX',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  // Python
  '__pycache__',
  '.venv',
  'venv',
  '.mypy_cache',
  '.pytest_cache',
  '.ruff_cache',
  '*.egg-info',
  // Rust
  'target',
  // Go
  'vendor',
  // Java/Kotlin
  '.gradle',
  '.mvn',
  // C/C++
  'cmake-build-debug',
  'cmake-build-release',
  // Generic
  '.idea',
  '.vscode',
  'tmp',
  'temp',
]);

export interface CollectedFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

function shouldExcludeDir(dirName: string, extraExcludes: Set<string>): boolean {
  return DEFAULT_EXCLUDE_DIRS.has(dirName) || extraExcludes.has(dirName);
}

export function collectWorkspaceFiles(
  workspaceRoot: string,
  options: {
    extraExcludeDirs?: string[];
    maxFileBytes?: number;
    extensions?: Set<string>;
  } = {},
): CollectedFile[] {
  const maxBytes = options.maxFileBytes ?? 200_000;
  const extensions = options.extensions ?? DEFAULT_INCLUDE_EXTENSIONS;
  const extraExcludes = new Set(options.extraExcludeDirs ?? []);

  const results: CollectedFile[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldExcludeDir(entry.name, extraExcludes)) continue;
        // Also check relative segment exclusions (e.g. "media/webview")
        const relDir = path.relative(workspaceRoot, absPath).replace(/\\/g, '/');
        if ([...DEFAULT_EXCLUDE_DIRS, ...extraExcludes].some(ex => relDir === ex || relDir.startsWith(ex + '/'))) {
          continue;
        }
        walk(absPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!extensions.has(ext)) continue;
        let stat: fs.Stats;
        try {
          stat = fs.statSync(absPath);
        } catch {
          continue;
        }
        if (stat.size > maxBytes) continue;
        results.push({
          relativePath: path.relative(workspaceRoot, absPath).replace(/\\/g, '/'),
          absolutePath: absPath,
          sizeBytes: stat.size,
        });
      }
    }
  }

  walk(workspaceRoot);
  return results;
}
