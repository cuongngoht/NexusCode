import {
  BoundaryDetector,
  DependencyGraphBuilder,
  type ArchitectureModule,
  type DependencyViolation,
  type LayerBoundary,
} from '../../context/architecture-memory';

export interface RuleMatchInput {
  baselineModules: ArchitectureModule[];
  changedModules: ArchitectureModule[];
  /** Normalized repo-relative paths of all changed files, including deleted ones. */
  changedPaths: ReadonlySet<string>;
  boundaries: LayerBoundary[];
  knownViolationIds: ReadonlySet<string>;
}

/**
 * Recomputes layer-boundary violations over the baseline module graph with
 * changed files swapped in, and returns only the violations that are NEW —
 * introduced by a changed file and absent from the persisted baseline.
 * Pre-existing architectural debt is never re-reported.
 */
export class ArchitectureRuleMatcher {
  match(input: RuleMatchInput): DependencyViolation[] {
    const merged = new Map<string, ArchitectureModule>();
    for (const mod of input.baselineModules) {
      // Shallow-copy: DependencyGraphBuilder mutates resolvedImportPaths and
      // the baseline snapshot must stay pristine.
      if (!input.changedPaths.has(mod.path)) {
        merged.set(mod.path, { ...mod });
      }
    }
    for (const mod of input.changedModules) {
      merged.set(mod.path, { ...mod });
    }

    const modules = [...merged.values()];
    const graph = new DependencyGraphBuilder().build(modules);
    const violations = new BoundaryDetector(input.boundaries).detect(graph, modules);

    return violations.filter(
      v => input.changedPaths.has(v.from) && !input.knownViolationIds.has(v.id),
    );
  }
}
