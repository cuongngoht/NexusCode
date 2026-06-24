export type ArchitectureLayer =
  | 'core'
  | 'application'
  | 'infrastructure'
  | 'interface'
  | 'support'
  | 'unknown';

export type ArchitectureStyle =
  | 'clean-architecture'
  | 'hexagonal'
  | 'mvc'
  | 'feature-based'
  | 'layered'
  | 'unknown';

export const ARCHITECTURE_MEMORY_SCHEMA_VERSION = 'architecture-memory-v1';
export const ARCHITECTURE_MEMORY_DIR = '.nexus/architecture-memory';
export const ARCHITECTURE_CONFIG_FILE = '.nexus/architecture-config.json';
export const ARCHITECTURE_MEMORY_FILES = {
  architectureJson: `${ARCHITECTURE_MEMORY_DIR}/architecture.json`,
  architectureMd: `${ARCHITECTURE_MEMORY_DIR}/architecture.md`,
  dependencyGraph: `${ARCHITECTURE_MEMORY_DIR}/dependency-graph.json`,
  violations: `${ARCHITECTURE_MEMORY_DIR}/violations.json`,
} as const;

export interface ArchitectureConfig {
  layers?: Partial<Record<ArchitectureLayer, string[]>>;
  rules?: Array<{
    from: ArchitectureLayer;
    to: ArchitectureLayer;
    kind: 'forbidden' | 'discouraged';
  }>;
}

export interface ArchitectureModule {
  path: string;
  layer: ArchitectureLayer;
  patterns: string[];
  imports: string[];
  resolvedImportPaths: string[];
  sourceEvidence: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  fromLayer: ArchitectureLayer;
  toLayer: ArchitectureLayer;
}

export interface DependencyGraph {
  nodes: string[];
  edges: DependencyEdge[];
  builtAt: number;
}

export type ViolationSeverity = 'error' | 'warning';

export interface DependencyViolation {
  id: string;
  from: string;
  to: string;
  fromLayer: ArchitectureLayer;
  toLayer: ArchitectureLayer;
  severity: ViolationSeverity;
  rule: string;
  sourceEvidence: string[];
}

export interface LayerBoundary {
  from: ArchitectureLayer;
  to: ArchitectureLayer;
  kind: 'forbidden' | 'discouraged';
  description: string;
}

export interface ArchitectureMemory {
  version: 1;
  schemaVersion: string;
  generatedAt: number;
  workspaceRoot: string;
  detectedStyle: ArchitectureStyle;
  configSource: 'user-config' | 'heuristic';
  modules: ArchitectureModule[];
  graph: DependencyGraph;
  violations: DependencyViolation[];
  layerSummary: Record<ArchitectureLayer, number>;
  layerPaths: Partial<Record<ArchitectureLayer, string[]>>;
}
