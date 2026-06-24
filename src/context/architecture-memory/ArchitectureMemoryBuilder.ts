import type { ArchitectureLayer, ArchitectureMemory } from './types';
import { ARCHITECTURE_MEMORY_SCHEMA_VERSION } from './types';
import type { ArchitectureConfigLoader } from './ArchitectureConfigLoader';
import type { ArchitectureStyleDetector } from './ArchitectureStyleDetector';
import { buildLayerDetectorFromConfig } from './LayerDetector';
import { PatternDetector } from './PatternDetector';
import { ModuleDetector } from './ModuleDetector';
import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { BoundaryDetector, buildBoundaries } from './BoundaryDetector';

export class ArchitectureMemoryBuilder {
  constructor(
    private readonly configLoader: ArchitectureConfigLoader,
    private readonly styleDetector: ArchitectureStyleDetector,
    private readonly graphBuilder: DependencyGraphBuilder,
  ) {}

  async build(workspaceRoot: string, files: string[]): Promise<ArchitectureMemory> {
    const config = await this.configLoader.load(workspaceRoot);
    const detected = await this.styleDetector.detect(workspaceRoot);

    const layerDetector = buildLayerDetectorFromConfig(config, detected);
    const boundaries = buildBoundaries(config, detected);
    const configSource: 'user-config' | 'heuristic' = config?.layers ? 'user-config' : 'heuristic';

    const moduleDetector = new ModuleDetector(layerDetector, new PatternDetector());
    const boundaryDetector = new BoundaryDetector(boundaries);

    const modules = await moduleDetector.detect(workspaceRoot, files);
    const graph = this.graphBuilder.build(modules);
    const violations = boundaryDetector.detect(graph, modules);

    const allLayers: ArchitectureLayer[] = ['core', 'application', 'infrastructure', 'interface', 'support', 'unknown'];
    const layerSummary = Object.fromEntries(
      allLayers.map(l => [l, modules.filter(m => m.layer === l).length]),
    ) as Record<ArchitectureLayer, number>;

    const layerPaths = { ...detected.layerPaths };
    if (config?.layers) {
      for (const [layer, paths] of Object.entries(config.layers) as Array<[ArchitectureLayer, string[] | undefined]>) {
        if (paths && paths.length > 0) {
          layerPaths[layer] = paths;
        }
      }
    }

    return {
      version: 1,
      schemaVersion: ARCHITECTURE_MEMORY_SCHEMA_VERSION,
      generatedAt: Date.now(),
      workspaceRoot,
      detectedStyle: detected.style,
      configSource,
      modules,
      graph,
      violations,
      layerSummary,
      layerPaths,
    };
  }
}
