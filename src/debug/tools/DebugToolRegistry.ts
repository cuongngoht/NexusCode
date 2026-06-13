/**
 * Registry of known debug tools and their detection signatures.
 * Used for display purposes and capability checks.
 */

export interface DebugToolEntry {
  id: string;
  displayName: string;
  configFiles: string[];
}

export const DEBUG_TOOL_REGISTRY: DebugToolEntry[] = [
  { id: 'typescript', displayName: 'TypeScript', configFiles: ['tsconfig.json'] },
  { id: 'vitest', displayName: 'Vitest', configFiles: ['vitest.config.ts', 'vitest.config.js'] },
  { id: 'jest', displayName: 'Jest', configFiles: ['jest.config.ts', 'jest.config.js', 'jest.config.json'] },
  { id: 'eslint', displayName: 'ESLint', configFiles: ['.eslintrc.json', 'eslint.config.js'] },
  { id: 'vite', displayName: 'Vite', configFiles: ['vite.config.ts', 'vite.config.js'] },
  { id: 'rollup', displayName: 'Rollup', configFiles: ['rollup.config.js', 'rollup.config.ts'] },
  { id: 'node', displayName: 'Node.js', configFiles: ['package.json'] },
  { id: 'bun', displayName: 'Bun', configFiles: ['bunfig.toml'] },
];
