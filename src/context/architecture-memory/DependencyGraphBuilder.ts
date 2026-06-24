import * as path from 'path';
import type { ArchitectureModule, DependencyEdge, DependencyGraph } from './types';

export class DependencyGraphBuilder {
  build(modules: ArchitectureModule[]): DependencyGraph {
    const moduleByPath = new Map<string, ArchitectureModule>();
    for (const mod of modules) {
      moduleByPath.set(mod.path, mod);
    }

    const edges: DependencyEdge[] = [];
    const resolvedCache = new Map<string, string | null>();

    for (const mod of modules) {
      const resolvedImportPaths: string[] = [];

      for (const specifier of mod.imports) {
        if (!isRelative(specifier)) continue;

        const resolved = resolveSpecifier(mod.path, specifier, moduleByPath, resolvedCache);
        if (!resolved) continue;

        resolvedImportPaths.push(resolved);

        const target = moduleByPath.get(resolved);
        if (!target) continue;

        edges.push({
          from: mod.path,
          to: resolved,
          fromLayer: mod.layer,
          toLayer: target.layer,
        });
      }

      mod.resolvedImportPaths = resolvedImportPaths;
    }

    return {
      nodes: modules.map(m => m.path),
      edges,
      builtAt: Date.now(),
    };
  }
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function resolveSpecifier(
  fromPath: string,
  specifier: string,
  moduleByPath: Map<string, ArchitectureModule>,
  cache: Map<string, string | null>,
): string | null {
  const cacheKey = `${fromPath}::${specifier}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const fromDir = path.dirname(fromPath).replace(/\\/g, '/');
  const rawResolved = path.posix.join(fromDir, specifier);

  const candidates = [
    rawResolved,
    `${rawResolved}.ts`,
    `${rawResolved}.tsx`,
    `${rawResolved}/index.ts`,
    `${rawResolved}/index.tsx`,
  ];

  for (const candidate of candidates) {
    if (moduleByPath.has(candidate)) {
      cache.set(cacheKey, candidate);
      return candidate;
    }
  }

  cache.set(cacheKey, null);
  return null;
}
