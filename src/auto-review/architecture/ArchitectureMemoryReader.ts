import {
  ArchitectureConfigLoader,
  ArchitectureMemoryLoader,
  ArchitectureMemoryValidator,
  boundariesForStyle,
  buildBoundaries,
  type ArchitectureMemory,
  type LayerBoundary,
} from '../../context/architecture-memory';

export interface ArchitectureSnapshot {
  memory: ArchitectureMemory;
  boundaries: LayerBoundary[];
  knownViolationIds: ReadonlySet<string>;
}

/**
 * Loads the persisted architecture memory baseline for drift checks.
 * Boundaries come from user config rules when present, otherwise from the
 * defaults of the persisted detected style — the same precedence the memory
 * builder used, so drift is judged against a consistent rule set.
 * Never throws: any missing/invalid state yields undefined and the drift
 * check is silently skipped.
 */
export class ArchitectureMemoryReader {
  constructor(
    private readonly loader = new ArchitectureMemoryLoader(),
    private readonly validator = new ArchitectureMemoryValidator(),
    private readonly configLoader = new ArchitectureConfigLoader(),
  ) {}

  async read(workspaceRoot: string): Promise<ArchitectureSnapshot | undefined> {
    try {
      const memory = await this.loader.loadMemory(workspaceRoot);
      if (!memory) return undefined;
      if (!this.validator.validate(memory).valid) return undefined;

      const config = await this.configLoader.load(workspaceRoot);
      const boundaries = buildBoundaries(config, {
        style: memory.detectedStyle,
        layerPaths: memory.layerPaths,
        boundaries: boundariesForStyle(memory.detectedStyle),
        confidence: 1,
      });
      if (boundaries.length === 0) return undefined;

      return {
        memory,
        boundaries,
        knownViolationIds: new Set(memory.violations.map(v => v.id)),
      };
    } catch {
      return undefined;
    }
  }
}
