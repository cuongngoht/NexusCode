import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

// Rust compiler error file reference:  --> src/main.rs:42:5
const RUST_FILE_RE = /-->\s+([\w./\-]+\.rs):(\d+):(\d+)/g;

function isRustSignal(ctx: DebugChainContext): boolean {
  const raw = ctx.signal?.raw ?? '';
  return (
    ctx.detectedLanguage === 'rust' ||
    /\berror\[E\d{4}\]/.test(raw) ||
    /-->\s+\S+\.rs:\d+/.test(raw) ||
    ctx.suspectedTools.includes('cargo') ||
    ctx.suspectedTools.includes('rustc')
  );
}

export class RustErrorStrategy implements DebugSearchStrategy {
  readonly name = 'rust-error';

  canHandle(ctx: DebugChainContext): boolean {
    return isRustSignal(ctx);
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];
    const raw = ctx.signal?.raw ?? '';

    // Extract .rs files from compiler output
    let m: RegExpExecArray | null;
    RUST_FILE_RE.lastIndex = 0;
    while ((m = RUST_FILE_RE.exec(raw)) !== null) {
      results.push({
        path: m[1],
        score: 200,
        reason: 'Rust compiler error source file',
      });
    }

    // Signal files fallback
    if (ctx.signal) {
      for (const ref of ctx.signal.files) {
        if (ref.path.endsWith('.rs')) {
          results.push({ path: ref.path, score: 180, reason: 'Rust error file' });
        }
      }
    }

    // Always include Cargo.toml
    if (fs.existsSync(path.join(ctx.workspaceRoot, 'Cargo.toml'))) {
      results.push({ path: 'Cargo.toml', score: 90, reason: 'Rust project manifest' });
    }
    if (fs.existsSync(path.join(ctx.workspaceRoot, 'Cargo.lock'))) {
      results.push({ path: 'Cargo.lock', score: 50, reason: 'Rust dependency lockfile' });
    }

    // Look for build.rs
    if (fs.existsSync(path.join(ctx.workspaceRoot, 'build.rs'))) {
      results.push({ path: 'build.rs', score: 60, reason: 'Rust build script' });
    }

    return results;
  }
}
