import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

// Go error/panic file reference: path/to/file.go:42 or /abs/path.go:42:5
const GO_FILE_RE = /([\w./\-]+\.go):(\d+)(?::(\d+))?/g;

// Go goroutine stack frame: path/to/pkg.FunctionName(...)
//   path/to/file.go:42 +0x...
const GO_GOROUTINE_FILE_RE = /\t([\w./\-]+\.go):(\d+)/g;

function isGoSignal(ctx: DebugChainContext): boolean {
  const raw = ctx.signal?.raw ?? '';
  return (
    ctx.detectedLanguage === 'go' ||
    /goroutine \d+ \[/.test(raw) ||
    /\.go:\d+:\d+:/.test(raw) ||
    /\bpanic:/.test(raw) && /\.go:\d+/.test(raw) ||
    ctx.suspectedTools.includes('go') ||
    ctx.suspectedTools.includes('golang')
  );
}

export class GoErrorStrategy implements DebugSearchStrategy {
  readonly name = 'go-error';

  canHandle(ctx: DebugChainContext): boolean {
    return isGoSignal(ctx);
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];
    const raw = ctx.signal?.raw ?? '';
    const seenPaths = new Set<string>();

    function addResult(filePath: string, score: number, reason: string): void {
      if (seenPaths.has(filePath)) return;
      seenPaths.add(filePath);
      results.push({ path: filePath, score, reason });
    }

    // Extract from goroutine stack
    let m: RegExpExecArray | null;
    GO_GOROUTINE_FILE_RE.lastIndex = 0;
    while ((m = GO_GOROUTINE_FILE_RE.exec(raw)) !== null) {
      const p = m[1];
      if (!p.includes('runtime/') && !p.startsWith('/usr/local/go/')) {
        addResult(p, 200, 'Go goroutine stack frame');
      }
    }

    // Extract from compiler errors
    GO_FILE_RE.lastIndex = 0;
    while ((m = GO_FILE_RE.exec(raw)) !== null) {
      const p = m[1];
      if (!p.includes('runtime/') && !p.startsWith('/usr/local/go/')) {
        addResult(p, 180, 'Go compiler error file');
      }
    }

    // Signal files
    if (ctx.signal) {
      for (const ref of ctx.signal.files) {
        if (ref.path.endsWith('.go')) {
          addResult(ref.path, 160, 'Go error file');
        }
      }
    }

    // Module and sum files
    if (fs.existsSync(path.join(ctx.workspaceRoot, 'go.mod'))) {
      addResult('go.mod', 80, 'Go module definition');
    }
    if (fs.existsSync(path.join(ctx.workspaceRoot, 'go.sum'))) {
      addResult('go.sum', 40, 'Go module checksums');
    }

    return results;
  }
}
