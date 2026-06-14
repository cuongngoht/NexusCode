import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

const BUILD_CONFIG_FILES = [
  { name: 'vite.config.ts', score: 90, reason: 'Vite build configuration' },
  { name: 'vite.config.js', score: 90, reason: 'Vite build configuration' },
  { name: 'rollup.config.ts', score: 80, reason: 'Rollup build configuration' },
  { name: 'rollup.config.js', score: 80, reason: 'Rollup build configuration' },
  { name: 'tsconfig.json', score: 85, reason: 'TypeScript build configuration' },
  { name: 'package.json', score: 70, reason: 'Package/build scripts' },
  { name: 'esbuild.config.js', score: 75, reason: 'ESBuild configuration' },
  { name: 'webpack.config.js', score: 75, reason: 'Webpack configuration' },
  { name: 'webpack.config.ts', score: 75, reason: 'Webpack configuration' },
];

export class BuildErrorStrategy implements DebugSearchStrategy {
  readonly name = 'build-error';

  canHandle(ctx: DebugChainContext): boolean {
    return (
      ctx.signal?.kind === 'build-error' ||
      ctx.suspectedTools.includes('vite') ||
      ctx.suspectedTools.includes('rollup')
    );
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];

    for (const cfg of BUILD_CONFIG_FILES) {
      if (fs.existsSync(path.join(ctx.workspaceRoot, cfg.name))) {
        results.push({ path: cfg.name, score: cfg.score, reason: cfg.reason });
      }
    }

    // Entrypoints referenced in the error
    if (ctx.signal) {
      for (const ref of ctx.signal.files) {
        results.push({
          path: ref.path,
          score: 150,
          reason: 'Build error source file',
        });
      }
    }

    return results;
  }
}
