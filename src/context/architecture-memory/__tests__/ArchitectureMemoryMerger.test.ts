import { describe, it, expect } from 'vitest';
import { ArchitectureMemoryMerger } from '../ArchitectureMemoryMerger';
import type { ArchitectureMemory, ArchitectureModule } from '../types';

function makeModule(path: string, overrides: Partial<ArchitectureModule> = {}): ArchitectureModule {
  return {
    path,
    layer: 'core',
    patterns: [],
    imports: [],
    resolvedImportPaths: [],
    sourceEvidence: [`evidence:${path}`],
    ...overrides,
  };
}

function makeBaseline(modules: ArchitectureModule[]): ArchitectureMemory {
  return {
    version: 1,
    schemaVersion: 'architecture-memory-v1',
    generatedAt: 0,
    workspaceRoot: '/tmp/ws',
    detectedStyle: 'unknown',
    configSource: 'heuristic',
    modules,
    graph: { nodes: [], edges: [], builtAt: 0 },
    violations: [],
    layerSummary: { core: 0, application: 0, infrastructure: 0, interface: 0, support: 0, unknown: 0 },
    layerPaths: {},
  };
}

describe('ArchitectureMemoryMerger', () => {
  const merger = new ArchitectureMemoryMerger();

  it('returns undefined when there is no baseline', () => {
    expect(merger.merge(undefined, [], [])).toBeUndefined();
  });

  it('replaces a module with the same path', () => {
    const baseline = makeBaseline([makeModule('src/core/Foo.ts', { patterns: ['old'] })]);
    const fresh = makeModule('src/core/Foo.ts', { patterns: ['new'] });

    const merged = merger.merge(baseline, [fresh], []);
    expect(merged).toHaveLength(1);
    expect(merged?.[0].patterns).toEqual(['new']);
  });

  it('drops a deleted path', () => {
    const baseline = makeBaseline([makeModule('src/core/Foo.ts'), makeModule('src/core/Bar.ts')]);
    const merged = merger.merge(baseline, [], ['src/core/Foo.ts']);
    expect(merged?.map(m => m.path)).toEqual(['src/core/Bar.ts']);
  });

  it('drops a rename old-path and adds the new path', () => {
    const baseline = makeBaseline([makeModule('src/core/Old.ts')]);
    const fresh = makeModule('src/core/New.ts');
    const merged = merger.merge(baseline, [fresh], ['src/core/Old.ts']);
    expect(merged?.map(m => m.path)).toEqual(['src/core/New.ts']);
  });

  it('preserves every module not in the changed or dropped sets, byte-identical', () => {
    const untouched = makeModule('src/application/Bar.ts', { patterns: ['use-case'], sourceEvidence: ['a', 'b'] });
    const baseline = makeBaseline([makeModule('src/core/Foo.ts'), untouched]);

    const merged = merger.merge(baseline, [makeModule('src/core/Foo.ts', { patterns: ['refreshed'] })], []);

    const preserved = merged?.find(m => m.path === 'src/application/Bar.ts');
    expect(preserved).toBe(untouched); // same object reference — never re-parsed or re-derived
  });

  it('never drops unrelated modules when only one path changes (regression)', () => {
    const modules = [
      makeModule('src/core/Foo.ts'),
      makeModule('src/application/Bar.ts'),
      makeModule('src/infrastructure/Baz.ts'),
    ];
    const baseline = makeBaseline(modules);

    const merged = merger.merge(baseline, [makeModule('src/core/Foo.ts', { patterns: ['refreshed'] })], []);

    expect(merged).toHaveLength(3);
    expect(merged?.map(m => m.path).sort()).toEqual(
      ['src/application/Bar.ts', 'src/core/Foo.ts', 'src/infrastructure/Baz.ts'].sort(),
    );
  });
});
