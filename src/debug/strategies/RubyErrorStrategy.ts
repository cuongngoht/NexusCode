import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

// Ruby stack frame: /path/to/file.rb:42:in `method_name'
const RUBY_FILE_RE = /([\w./\-]+\.(?:rb|rake)):\d+:in\s+`/g;

// RSpec failure: rspec ./spec/some_spec.rb:42
const RSPEC_FILE_RE = /rspec\s+([\w./\-]+\.rb)(?::\d+)?/g;

function isRubySignal(ctx: DebugChainContext): boolean {
  const raw = ctx.signal?.raw ?? '';
  return (
    ctx.detectedLanguage === 'ruby' ||
    /\bNoMethodError\b/.test(raw) ||
    /\bLoadError\b/.test(raw) ||
    /\.rb:\d+:in\s+`/.test(raw) ||
    /\bRSpec\b|\bRspec\b/.test(raw) ||
    ctx.suspectedTools.includes('rspec') ||
    ctx.suspectedTools.includes('ruby') ||
    ctx.suspectedTools.includes('rails')
  );
}

export class RubyErrorStrategy implements DebugSearchStrategy {
  readonly name = 'ruby-error';

  canHandle(ctx: DebugChainContext): boolean {
    return isRubySignal(ctx);
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];
    const raw = ctx.signal?.raw ?? '';
    const seenPaths = new Set<string>();

    function addResult(filePath: string, score: number, reason: string): void {
      const rel = filePath.startsWith(ctx.workspaceRoot)
        ? path.relative(ctx.workspaceRoot, filePath).replace(/\\/g, '/')
        : filePath.replace(/\\/g, '/');
      if (seenPaths.has(rel)) return;
      seenPaths.add(rel);
      results.push({ path: rel, score, reason });
    }

    // Ruby stack trace files
    let m: RegExpExecArray | null;
    RUBY_FILE_RE.lastIndex = 0;
    while ((m = RUBY_FILE_RE.exec(raw)) !== null) {
      const p = m[1];
      if (!p.includes('/gems/') && !p.startsWith('/usr/lib/ruby/')) {
        addResult(p, 200, 'Ruby stack trace file');
      }
    }

    // RSpec failure files
    RSPEC_FILE_RE.lastIndex = 0;
    while ((m = RSPEC_FILE_RE.exec(raw)) !== null) {
      addResult(m[1], 190, 'RSpec failure file');
    }

    // Signal files
    if (ctx.signal) {
      for (const ref of ctx.signal.files) {
        if (/\.(rb|rake)$/.test(ref.path)) {
          addResult(ref.path, 160, 'Ruby error file');
        }
      }
    }

    // Bundler / Gemfile
    for (const gemFile of ['Gemfile', 'Gemfile.lock', '.ruby-version']) {
      if (fs.existsSync(path.join(ctx.workspaceRoot, gemFile))) {
        results.push({ path: gemFile, score: 70, reason: 'Ruby/Bundler configuration' });
      }
    }

    // Rails application.rb if present
    const appConfig = path.join('config', 'application.rb');
    if (fs.existsSync(path.join(ctx.workspaceRoot, appConfig))) {
      results.push({ path: appConfig, score: 60, reason: 'Rails application configuration' });
    }

    return results;
  }
}
