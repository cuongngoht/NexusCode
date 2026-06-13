import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

type ToolConfigEntry = {
  configFiles: string[];
  score: number;
  reason: string;
};

const TOOL_CONFIG_MAP: Record<string, ToolConfigEntry> = {
  typescript: {
    configFiles: ['tsconfig.json', 'tsconfig.build.json', 'tsconfig.app.json', 'tsconfig.test.json'],
    score: 80,
    reason: 'TypeScript configuration',
  },
  vite: {
    configFiles: ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs'],
    score: 75,
    reason: 'Vite configuration',
  },
  vitest: {
    configFiles: ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts', 'vite.config.js'],
    score: 75,
    reason: 'Vitest configuration',
  },
  jest: {
    configFiles: ['jest.config.ts', 'jest.config.js', 'jest.config.json', 'jest.setup.ts'],
    score: 75,
    reason: 'Jest configuration',
  },
  eslint: {
    configFiles: ['.eslintrc.json', '.eslintrc.js', '.eslintrc.ts', '.eslintrc.yml', '.eslintrc.yaml', 'eslint.config.js', 'eslint.config.ts'],
    score: 65,
    reason: 'ESLint configuration',
  },
  npm: {
    configFiles: ['package.json', '.npmrc'],
    score: 60,
    reason: 'npm package configuration',
  },
  pnpm: {
    configFiles: ['package.json', 'pnpm-workspace.yaml', '.npmrc'],
    score: 60,
    reason: 'pnpm package configuration',
  },
  yarn: {
    configFiles: ['package.json', '.yarnrc.yml', '.yarnrc'],
    score: 60,
    reason: 'Yarn package configuration',
  },
  bun: {
    configFiles: ['package.json', 'bunfig.toml'],
    score: 60,
    reason: 'Bun package configuration',
  },
  node: {
    configFiles: ['package.json', '.nvmrc', '.node-version'],
    score: 55,
    reason: 'Node.js configuration',
  },
  rollup: {
    configFiles: ['rollup.config.ts', 'rollup.config.js', 'rollup.config.mjs'],
    score: 70,
    reason: 'Rollup configuration',
  },
};

export class ConfigFileStrategy implements DebugSearchStrategy {
  readonly name = 'config-file';

  canHandle(ctx: DebugChainContext): boolean {
    return ctx.suspectedTools.some(t => t in TOOL_CONFIG_MAP);
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];
    const seen = new Set<string>();

    for (const tool of ctx.suspectedTools) {
      const entry = TOOL_CONFIG_MAP[tool];
      if (!entry) continue;

      for (const configFile of entry.configFiles) {
        if (seen.has(configFile)) continue;
        if (fs.existsSync(path.join(ctx.workspaceRoot, configFile))) {
          results.push({
            path: configFile,
            score: entry.score,
            reason: entry.reason,
          });
          seen.add(configFile);
        }
      }
    }

    return results;
  }
}
