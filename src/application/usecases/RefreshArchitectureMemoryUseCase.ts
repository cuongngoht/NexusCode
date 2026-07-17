import type { ResolvedChange } from '../../git/ChangedFilePathResolver';
import {
  ArchitectureMemoryBuilder,
  ArchitectureMemoryMerger,
  ArchitectureMemoryLoader,
  ArchitectureMemoryWriter,
  ArchitectureMarkdownRenderer,
  ArchitectureConfigLoader,
  DependencyGraphBuilder,
  ModuleDetector,
  PatternDetector,
  buildLayerDetectorFromConfig,
  isEligibleFile,
} from '../../context/architecture-memory';
import { ArchitectureStyleDetector } from '../../context/architecture-memory/ArchitectureStyleDetector';
import { NexusFileTreeScanner } from '../../context/project-map/NexusFileTreeScanner';
import { ArchitectureRefreshGate } from './ArchitectureRefreshGate';

export interface RefreshArchitectureMemoryInput {
  workspaceRoot: string;
  changedPaths: ResolvedChange[];
}

export type RefreshArchitectureMemoryOutput =
  | { kind: 'skipped'; reason: 'no-eligible-paths' | 'no-baseline' | 'coalesced' }
  | { kind: 'refreshed'; filesWritten: string[]; moduleCount: number; violationCount: number }
  | { kind: 'full-rebuild'; filesWritten: string[]; moduleCount: number; violationCount: number };

export class RefreshArchitectureMemoryUseCase {
  constructor(
    private readonly configLoader: ArchitectureConfigLoader = new ArchitectureConfigLoader(),
    private readonly styleDetector: ArchitectureStyleDetector = new ArchitectureStyleDetector(),
    private readonly loader: ArchitectureMemoryLoader = new ArchitectureMemoryLoader(),
    private readonly builder: ArchitectureMemoryBuilder = new ArchitectureMemoryBuilder(
      new ArchitectureConfigLoader(),
      new ArchitectureStyleDetector(),
      new DependencyGraphBuilder(),
    ),
    private readonly merger: ArchitectureMemoryMerger = new ArchitectureMemoryMerger(),
    private readonly renderer: ArchitectureMarkdownRenderer = new ArchitectureMarkdownRenderer(),
    private readonly writer: ArchitectureMemoryWriter = new ArchitectureMemoryWriter(),
    private readonly gate: ArchitectureRefreshGate = new ArchitectureRefreshGate(),
    private readonly fileTreeScanner: NexusFileTreeScanner = new NexusFileTreeScanner(),
  ) {}

  async execute(input: RefreshArchitectureMemoryInput): Promise<RefreshArchitectureMemoryOutput> {
    const eligible = input.changedPaths.filter(c => isEligibleFile(c.path));
    if (eligible.length === 0) {
      return { kind: 'skipped', reason: 'no-eligible-paths' };
    }

    const baseline = await this.loader.loadMemory(input.workspaceRoot);
    if (!baseline) {
      // Never implicitly trigger a first full scan — the user must run scan-project once.
      return { kind: 'skipped', reason: 'no-baseline' };
    }

    const result = await this.gate.run(input.workspaceRoot, () => this.refresh(input.workspaceRoot, eligible, baseline));
    if ('kind' in result && result.kind === 'coalesced') {
      return { kind: 'skipped', reason: 'coalesced' };
    }
    return result;
  }

  private async refresh(
    workspaceRoot: string,
    eligible: ResolvedChange[],
    baseline: NonNullable<Awaited<ReturnType<ArchitectureMemoryLoader['loadMemory']>>>,
  ): Promise<RefreshArchitectureMemoryOutput> {
    const config = await this.configLoader.load(workspaceRoot);
    const detected = await this.styleDetector.detect(workspaceRoot);
    const configSource: 'user-config' | 'heuristic' = config?.layers ? 'user-config' : 'heuristic';

    // Layer/boundary reassignment from a config or detected-style change could affect every
    // module, not just the touched ones — an incremental merge would be unsafe here.
    const configOrStyleChanged = detected.style !== baseline.detectedStyle || configSource !== baseline.configSource;
    if (configOrStyleChanged) {
      return this.fullRebuild(workspaceRoot, config, detected);
    }

    const layerDetector = buildLayerDetectorFromConfig(config, detected);
    const moduleDetector = new ModuleDetector(layerDetector, new PatternDetector());

    const deletedOrRenamedOldPaths = eligible.filter(c => c.status.startsWith('D')).map(c => c.path);
    const touchedFiles = eligible.filter(c => !c.status.startsWith('D')).map(c => c.path);

    const changedModules = await moduleDetector.detect(workspaceRoot, touchedFiles);
    const mergedModules = this.merger.merge(baseline, changedModules, deletedOrRenamedOldPaths);
    if (!mergedModules) {
      return this.fullRebuild(workspaceRoot, config, detected);
    }

    const memory = await this.builder.assemble(workspaceRoot, mergedModules, config, detected);
    const markdown = this.renderer.render(memory);
    const { filesWritten } = await this.writer.write(workspaceRoot, memory, markdown);
    return { kind: 'refreshed', filesWritten, moduleCount: memory.modules.length, violationCount: memory.violations.length };
  }

  private async fullRebuild(
    workspaceRoot: string,
    config: Awaited<ReturnType<ArchitectureConfigLoader['load']>>,
    detected: Awaited<ReturnType<ArchitectureStyleDetector['detect']>>,
  ): Promise<RefreshArchitectureMemoryOutput> {
    const snapshot = await this.fileTreeScanner.scan(workspaceRoot);
    const files = snapshot.files.filter(isEligibleFile);

    const layerDetector = buildLayerDetectorFromConfig(config, detected);
    const moduleDetector = new ModuleDetector(layerDetector, new PatternDetector());
    const modules = await moduleDetector.detect(workspaceRoot, files);

    const memory = await this.builder.assemble(workspaceRoot, modules, config, detected);
    const markdown = this.renderer.render(memory);
    const { filesWritten } = await this.writer.write(workspaceRoot, memory, markdown);
    return { kind: 'full-rebuild', filesWritten, moduleCount: memory.modules.length, violationCount: memory.violations.length };
  }
}
