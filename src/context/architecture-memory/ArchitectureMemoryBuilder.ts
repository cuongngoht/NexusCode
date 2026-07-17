import type { ArchitectureLayer, ArchitectureMemory, ArchitectureConfig, ArchitectureModule } from './types';
import { ARCHITECTURE_MEMORY_SCHEMA_VERSION } from './types';
import type { ArchitectureConfigLoader } from './ArchitectureConfigLoader';
import type { ArchitectureStyleDetector, StyleDetectionResult } from './ArchitectureStyleDetector';
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
    const moduleDetector = new ModuleDetector(layerDetector, new PatternDetector());
    const modules = await moduleDetector.detect(workspaceRoot, files);

    return this.assemble(workspaceRoot, modules, config, detected);
  }

  /**
   * Recomputes the graph/violations/layer summary from an already-detected module list,
   * skipping the parse/detect phase entirely. Used by incremental refresh, where only a
   * subset of modules was freshly re-detected and the rest are carried over from a baseline.
   */
  async assemble(
    workspaceRoot: string,
    modules: ArchitectureModule[],
    config?: ArchitectureConfig,
    detected?: StyleDetectionResult,
  ): Promise<ArchitectureMemory> {
    const resolvedConfig = config !== undefined ? config : await this.configLoader.load(workspaceRoot);
    const resolvedDetected = detected ?? (await this.styleDetector.detect(workspaceRoot));

    const boundaries = buildBoundaries(resolvedConfig, resolvedDetected);
    const configSource: 'user-config' | 'heuristic' = resolvedConfig?.layers ? 'user-config' : 'heuristic';

    const boundaryDetector = new BoundaryDetector(boundaries);
    const graph = this.graphBuilder.build(modules);
    const violations = boundaryDetector.detect(graph, modules);

    const allLayers: ArchitectureLayer[] = ['core', 'application', 'infrastructure', 'interface', 'support', 'unknown'];
    const layerSummary = Object.fromEntries(
      allLayers.map(l => [l, modules.filter(m => m.layer === l).length]),
    ) as Record<ArchitectureLayer, number>;

    const layerPaths = { ...resolvedDetected.layerPaths };
    if (resolvedConfig?.layers) {
      for (const [layer, paths] of Object.entries(resolvedConfig.layers) as Array<[ArchitectureLayer, string[] | undefined]>) {
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
      detectedStyle: resolvedDetected.style,
      configSource,
      modules,
      graph,
      violations,
      layerSummary,
      layerPaths,
    };
  }
}
