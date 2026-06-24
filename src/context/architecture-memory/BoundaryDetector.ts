import type {
  ArchitectureConfig,
  ArchitectureModule,
  DependencyGraph,
  DependencyViolation,
  LayerBoundary,
} from './types';
import type { StyleDetectionResult } from './ArchitectureStyleDetector';

export class BoundaryDetector {
  constructor(private readonly boundaries: LayerBoundary[]) {}

  detect(graph: DependencyGraph, _modules: ArchitectureModule[]): DependencyViolation[] {
    const violations: DependencyViolation[] = [];

    for (const edge of graph.edges) {
      if (edge.fromLayer === 'unknown' || edge.toLayer === 'unknown') continue;
      if (edge.fromLayer === 'support' || edge.toLayer === 'support') continue;

      for (const boundary of this.boundaries) {
        if (boundary.from === edge.fromLayer && boundary.to === edge.toLayer) {
          violations.push({
            id: `${edge.from}->${edge.to}`,
            from: edge.from,
            to: edge.to,
            fromLayer: edge.fromLayer,
            toLayer: edge.toLayer,
            severity: boundary.kind === 'forbidden' ? 'error' : 'warning',
            rule: boundary.description,
            sourceEvidence: [`${edge.from} imports ${edge.to}`],
          });
          break;
        }
      }
    }

    return violations;
  }
}

export function buildBoundaries(
  config: ArchitectureConfig | undefined,
  detected: StyleDetectionResult,
): LayerBoundary[] {
  if (config?.rules && config.rules.length > 0) {
    return config.rules.map(r => ({
      from: r.from,
      to: r.to,
      kind: r.kind,
      description: `${r.from} must not import from ${r.to}`,
    }));
  }
  return detected.boundaries;
}
