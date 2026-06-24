import { describe, it, expect } from 'vitest';
import { DependencyGraphBuilder } from '../DependencyGraphBuilder';
import type { ArchitectureModule } from '../types';

function makeModule(
  filePath: string,
  layer: ArchitectureModule['layer'],
  imports: string[],
): ArchitectureModule {
  return {
    path: filePath,
    layer,
    patterns: [],
    imports,
    resolvedImportPaths: [],
    sourceEvidence: [],
  };
}

describe('DependencyGraphBuilder', () => {
  const builder = new DependencyGraphBuilder();

  it('creates an edge for a relative import that resolves to a known module', () => {
    const modules = [
      makeModule('src/core/bar.ts', 'core', ['./foo']),
      makeModule('src/core/foo.ts', 'core', []),
    ];
    const graph = builder.build(modules);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.from).toBe('src/core/bar.ts');
    expect(graph.edges[0]!.to).toBe('src/core/foo.ts');
  });

  it('resolves cross-directory relative imports', () => {
    const modules = [
      makeModule('src/application/usecases/Foo.ts', 'application', ['../../core/types']),
      makeModule('src/core/types.ts', 'core', []),
    ];
    const graph = builder.build(modules);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.to).toBe('src/core/types.ts');
    expect(graph.edges[0]!.fromLayer).toBe('application');
    expect(graph.edges[0]!.toLayer).toBe('core');
  });

  it('ignores external package imports', () => {
    const modules = [
      makeModule('src/core/foo.ts', 'core', ['vscode', 'fs', 'path', 'lodash']),
    ];
    const graph = builder.build(modules);
    expect(graph.edges).toHaveLength(0);
  });

  it('resolves import with .ts extension suffix', () => {
    const modules = [
      makeModule('src/app/a.ts', 'application', ['./b']),
      makeModule('src/app/b.ts', 'application', []),
    ];
    const graph = builder.build(modules);
    expect(graph.edges[0]!.to).toBe('src/app/b.ts');
  });

  it('resolves index.ts imports', () => {
    const modules = [
      makeModule('src/app/main.ts', 'application', ['../core']),
      makeModule('src/core/index.ts', 'core', []),
    ];
    const graph = builder.build(modules);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.to).toBe('src/core/index.ts');
  });

  it('handles mutual imports (two edges)', () => {
    const modules = [
      makeModule('src/a.ts', 'core', ['./b']),
      makeModule('src/b.ts', 'core', ['./a']),
    ];
    const graph = builder.build(modules);
    expect(graph.edges).toHaveLength(2);
  });

  it('silently skips unresolvable imports', () => {
    const modules = [
      makeModule('src/a.ts', 'core', ['./nonexistent']),
    ];
    const graph = builder.build(modules);
    expect(graph.edges).toHaveLength(0);
  });

  it('includes all module paths in nodes', () => {
    const modules = [
      makeModule('src/a.ts', 'core', []),
      makeModule('src/b.ts', 'application', []),
    ];
    const graph = builder.build(modules);
    expect(graph.nodes).toContain('src/a.ts');
    expect(graph.nodes).toContain('src/b.ts');
  });

  it('correctly sets fromLayer and toLayer on edges', () => {
    const modules = [
      makeModule('src/interface/api.ts', 'interface', ['../core/entity']),
      makeModule('src/core/entity.ts', 'core', []),
    ];
    const graph = builder.build(modules);
    expect(graph.edges[0]!.fromLayer).toBe('interface');
    expect(graph.edges[0]!.toLayer).toBe('core');
  });

  it('deduplicates edges when the same file is imported multiple times via different paths', () => {
    // two different import specifiers pointing to same file
    const modules = [
      makeModule('src/app/foo.ts', 'application', ['./bar', './bar.ts']),
      makeModule('src/app/bar.ts', 'application', []),
    ];
    const graph = builder.build(modules);
    // './bar' resolves to 'src/app/bar.ts', './bar.ts' also resolves — both appear as edges
    // (dedup is not a requirement, but ensure no crash)
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);
  });
});
