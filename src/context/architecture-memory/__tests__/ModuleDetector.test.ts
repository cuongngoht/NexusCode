import { describe, it, expect } from 'vitest';
import { isEligibleFile, parseImports } from '../ModuleDetector';

describe('isEligibleFile', () => {
  it('accepts plain .ts and .tsx files', () => {
    expect(isEligibleFile('src/core/Foo.ts')).toBe(true);
    expect(isEligibleFile('src/webview-ui/App.tsx')).toBe(true);
  });

  it('rejects non-TS/TSX files', () => {
    expect(isEligibleFile('src/core/Foo.js')).toBe(false);
    expect(isEligibleFile('README.md')).toBe(false);
    expect(isEligibleFile('src/context/promptBuilder.json')).toBe(false);
  });

  it('rejects test/spec/declaration files', () => {
    expect(isEligibleFile('src/core/Foo.test.ts')).toBe(false);
    expect(isEligibleFile('src/core/Foo.test.tsx')).toBe(false);
    expect(isEligibleFile('src/core/Foo.spec.ts')).toBe(false);
    expect(isEligibleFile('src/core/Foo.spec.tsx')).toBe(false);
    expect(isEligibleFile('src/core/Foo.d.ts')).toBe(false);
  });

  it('rejects files under skipped path segments', () => {
    expect(isEligibleFile('node_modules/lib/index.ts')).toBe(false);
    expect(isEligibleFile('.nexus/architecture-memory/architecture.ts')).toBe(false);
    expect(isEligibleFile('dist/extension.ts')).toBe(false);
    expect(isEligibleFile('build/out.ts')).toBe(false);
    expect(isEligibleFile('out/out.ts')).toBe(false);
    expect(isEligibleFile('coverage/report.ts')).toBe(false);
    expect(isEligibleFile('__pycache__/mod.ts')).toBe(false);
  });

  it('normalizes backslash path separators before checking', () => {
    expect(isEligibleFile('src\\core\\Foo.ts')).toBe(true);
    expect(isEligibleFile('node_modules\\lib\\index.ts')).toBe(false);
    expect(isEligibleFile('src\\core\\Foo.test.ts')).toBe(false);
  });
});

describe('parseImports', () => {
  it('extracts static import specifiers', () => {
    const content = `import { Foo } from './Foo';\nimport type { Bar } from '../Bar';`;
    expect(parseImports(content)).toEqual(expect.arrayContaining(['./Foo', '../Bar']));
  });

  it('extracts dynamic import/require specifiers', () => {
    const content = `const x = require('./x');\nconst y = await import('./y');`;
    const result = parseImports(content);
    expect(result).toEqual(expect.arrayContaining(['./x', './y']));
  });

  it('deduplicates repeated specifiers', () => {
    const content = `import { A } from './A';\nimport { B } from './A';`;
    expect(parseImports(content).filter(s => s === './A')).toHaveLength(1);
  });
});
