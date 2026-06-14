import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';
import { collectWorkspaceFiles } from '../search/WorkspaceFileCollector';

export class TestFailureStrategy implements DebugSearchStrategy {
  readonly name = 'test-failure';

  canHandle(ctx: DebugChainContext): boolean {
    return (
      ctx.signal?.kind === 'test-failure' ||
      ctx.suspectedTools.includes('vitest') ||
      ctx.suspectedTools.includes('jest')
    );
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];

    // Find test files related to explicitly referenced files
    const refBasenames = (ctx.signal?.files ?? []).map(
      f => path.basename(f.path, path.extname(f.path))
    );

    // Collect test files
    const files = collectWorkspaceFiles(ctx.workspaceRoot, {
      extraExcludeDirs: ctx.projectExcludeFromIndex,
      maxFileBytes: ctx.maxFileBytes,
    });

    for (const file of files) {
      const isTestFile = /\.test\.|\.spec\.|__tests__\//.test(file.relativePath);
      const stem = path.basename(file.relativePath, path.extname(file.relativePath))
        .replace(/\.(test|spec)$/, '');

      if (isTestFile) {
        let score = 50;
        let reason = 'Test file';

        // Boost if stem matches a referenced file's basename
        if (refBasenames.some(rb => stem === rb || stem.includes(rb) || rb.includes(stem))) {
          score += 100;
          reason = 'Test file matching error source';
        }

        results.push({ path: file.relativePath, score, reason });
      }

      // Also boost source files that match referenced basenames
      if (!isTestFile && refBasenames.some(rb => {
        const fileStem = path.basename(file.relativePath, path.extname(file.relativePath));
        return fileStem === rb;
      })) {
        results.push({
          path: file.relativePath,
          score: 80,
          reason: 'Source file matching test failure reference',
        });
      }
    }

    // Vitest config
    if (ctx.suspectedTools.includes('vitest')) {
      for (const configName of ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts', 'vite.config.js']) {
        if (fs.existsSync(path.join(ctx.workspaceRoot, configName))) {
          results.push({ path: configName, score: 40, reason: 'Vitest/Vite configuration' });
        }
      }
    }

    // Jest config
    if (ctx.suspectedTools.includes('jest')) {
      for (const configName of ['jest.config.ts', 'jest.config.js', 'jest.config.json', 'jest.setup.ts', 'jest.setup.js']) {
        if (fs.existsSync(path.join(ctx.workspaceRoot, configName))) {
          results.push({ path: configName, score: 40, reason: 'Jest configuration' });
        }
      }
    }

    return results;
  }
}
