import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

// C# compiler error: /path/to/File.cs(42,5): error CS0103: identifier not found
const CSHARP_ERROR_FILE_RE = /([\w./\-\\]+\.(?:cs|vb|fs))\((\d+),(\d+)\):\s+(?:error|warning)\s+(CS\d+)/g;

// Dotnet build output: /path/to/File.cs(42,5):
const DOTNET_FILE_RE = /([\w./\-\\]+\.(?:cs|vb|fs))\((\d+),(\d+)\)/g;

function isCSharpSignal(ctx: DebugChainContext): boolean {
  const raw = ctx.signal?.raw ?? '';
  return (
    ctx.detectedLanguage === 'csharp' ||
    /\bCS\d{4}\b/.test(raw) ||
    /\.cs\(\d+,\d+\):/.test(raw) ||
    /\bdotnet\s+(build|test|run)\b/.test(raw) ||
    /Build FAILED\.|Error\(s\) in/i.test(raw) && /\.cs\b/.test(raw) ||
    ctx.suspectedTools.includes('dotnet') ||
    ctx.suspectedTools.includes('csharp')
  );
}

export class CSharpErrorStrategy implements DebugSearchStrategy {
  readonly name = 'csharp-error';

  canHandle(ctx: DebugChainContext): boolean {
    return isCSharpSignal(ctx);
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];
    const raw = ctx.signal?.raw ?? '';
    const seenPaths = new Set<string>();

    function addResult(filePath: string, score: number, reason: string): void {
      const normalized = filePath.replace(/\\/g, '/');
      const rel = normalized.startsWith(ctx.workspaceRoot.replace(/\\/g, '/'))
        ? path.relative(ctx.workspaceRoot, filePath).replace(/\\/g, '/')
        : normalized;
      if (seenPaths.has(rel)) return;
      seenPaths.add(rel);
      results.push({ path: rel, score, reason });
    }

    // C# compiler errors
    let m: RegExpExecArray | null;
    CSHARP_ERROR_FILE_RE.lastIndex = 0;
    while ((m = CSHARP_ERROR_FILE_RE.exec(raw)) !== null) {
      addResult(m[1], 200, `C# compiler error ${m[4]}`);
    }

    // Dotnet build output
    DOTNET_FILE_RE.lastIndex = 0;
    while ((m = DOTNET_FILE_RE.exec(raw)) !== null) {
      addResult(m[1], 180, 'Dotnet build error file');
    }

    // Signal files
    if (ctx.signal) {
      for (const ref of ctx.signal.files) {
        if (/\.(cs|vb|fs)$/.test(ref.path)) {
          addResult(ref.path, 160, 'C# error file');
        }
      }
    }

    // Scan for .csproj and .sln files in workspace root
    try {
      const rootEntries = fs.readdirSync(ctx.workspaceRoot);
      for (const entry of rootEntries) {
        if (entry.endsWith('.csproj') || entry.endsWith('.sln') || entry.endsWith('.fsproj') || entry.endsWith('.vbproj')) {
          addResult(entry, 75, 'C# project/solution file');
        }
      }
    } catch {
      // non-fatal
    }

    return results;
  }
}
