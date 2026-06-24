export {
  ARCHITECTURE_MEMORY_SCHEMA_VERSION,
  ARCHITECTURE_MEMORY_DIR,
  ARCHITECTURE_CONFIG_FILE,
  ARCHITECTURE_MEMORY_FILES,
  type ArchitectureLayer,
  type ArchitectureStyle,
  type ArchitectureConfig,
  type ArchitectureModule,
  type DependencyEdge,
  type DependencyGraph,
  type ViolationSeverity,
  type DependencyViolation,
  type LayerBoundary,
  type ArchitectureMemory,
} from './types';

export { ArchitectureConfigLoader } from './ArchitectureConfigLoader';
export { ArchitectureStyleDetector, type StyleDetectionResult } from './ArchitectureStyleDetector';
export { LayerDetector, buildLayerDetectorFromConfig } from './LayerDetector';
export { PatternDetector } from './PatternDetector';
export { ModuleDetector, parseImports } from './ModuleDetector';
export { DependencyGraphBuilder } from './DependencyGraphBuilder';
export { BoundaryDetector, buildBoundaries } from './BoundaryDetector';
export { ArchitectureMemoryBuilder } from './ArchitectureMemoryBuilder';
export { ArchitectureMarkdownRenderer } from './ArchitectureMarkdownRenderer';
export { ArchitectureMemoryWriter } from './ArchitectureMemoryWriter';
export { ArchitectureMemoryLoader } from './ArchitectureMemoryLoader';
export { ArchitectureMemoryValidator } from './ArchitectureMemoryValidator';
export { ArchitecturePromptBuilder, type ArchitecturePromptBuildOptions } from './ArchitecturePromptBuilder';

export { ArchitectureIndexBuilder } from './search/ArchitectureIndexBuilder';
export { ArchitectureRagFacade, type ArchitectureRagOptions } from './search/ArchitectureRagFacade';
export type {
  ArchitectureDocument,
  ArchitectureDocumentSource,
  ArchitectureCorpusStats,
  ArchitectureSearchIndex,
  ArchitectureSearchResult,
} from './search/ArchitectureDocument';
