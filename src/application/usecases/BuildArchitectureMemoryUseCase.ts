import {
  ArchitectureMemoryBuilder,
  ArchitectureMarkdownRenderer,
  ArchitectureMemoryWriter,
  ArchitectureConfigLoader,
  DependencyGraphBuilder,
  type ArchitectureMemory,
  type ArchitectureStyle,
} from '../../context/architecture-memory';
import { ArchitectureStyleDetector } from '../../context/architecture-memory/ArchitectureStyleDetector';

export type BuildArchitectureMemoryInput = {
  workspaceRoot: string;
  files: string[];
};

export type BuildArchitectureMemoryOutput = {
  memory: ArchitectureMemory;
  filesWritten: string[];
  violationCount: number;
  moduleCount: number;
  detectedStyle: ArchitectureStyle;
  configSource: 'user-config' | 'heuristic';
};

export class BuildArchitectureMemoryUseCase {
  constructor(
    private readonly builder: ArchitectureMemoryBuilder = new ArchitectureMemoryBuilder(
      new ArchitectureConfigLoader(),
      new ArchitectureStyleDetector(),
      new DependencyGraphBuilder(),
    ),
    private readonly renderer: ArchitectureMarkdownRenderer = new ArchitectureMarkdownRenderer(),
    private readonly writer: ArchitectureMemoryWriter = new ArchitectureMemoryWriter(),
  ) {}

  async execute(input: BuildArchitectureMemoryInput): Promise<BuildArchitectureMemoryOutput> {
    const eligibleFiles = input.files.filter(f => {
      const norm = f.replace(/\\/g, '/');
      return (
        (norm.endsWith('.ts') || norm.endsWith('.tsx')) &&
        !norm.endsWith('.test.ts') &&
        !norm.endsWith('.test.tsx') &&
        !norm.endsWith('.spec.ts') &&
        !norm.endsWith('.spec.tsx') &&
        !norm.endsWith('.d.ts')
      );
    });

    const memory = await this.builder.build(input.workspaceRoot, eligibleFiles);
    const markdown = this.renderer.render(memory);
    const { filesWritten } = await this.writer.write(input.workspaceRoot, memory, markdown);

    return {
      memory,
      filesWritten,
      violationCount: memory.violations.length,
      moduleCount: memory.modules.length,
      detectedStyle: memory.detectedStyle,
      configSource: memory.configSource,
    };
  }
}
