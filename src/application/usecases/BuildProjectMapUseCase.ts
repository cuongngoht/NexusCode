import { NexusFileTreeScanner } from '../../context/project-map/NexusFileTreeScanner';
import { NexusMarkerDetector } from '../../context/project-map/NexusMarkerDetector';
import { NexusProjectUnitDetector } from '../../context/project-map/NexusProjectUnitDetector';
import { NexusProjectMapBuilder } from '../../context/project-map/NexusProjectMapBuilder';
import { NexusProjectMapWriter } from '../../context/project-map/NexusProjectMapWriter';
import type { ProjectMapResult } from '../../context/project-map/types';

export type BuildProjectMapInput = {
  workspaceRoot: string;
  maxDepth?: number;
  maxFiles?: number;
};

export type BuildProjectMapOutput = ProjectMapResult & {
  filesWritten: string[];
};

export class BuildProjectMapUseCase {
  constructor(
    private readonly scanner: NexusFileTreeScanner,
    private readonly markerDetector: NexusMarkerDetector,
    private readonly unitDetector: NexusProjectUnitDetector,
    private readonly mapBuilder: NexusProjectMapBuilder,
    private readonly writer: NexusProjectMapWriter,
  ) {}

  async execute(input: BuildProjectMapInput): Promise<BuildProjectMapOutput> {
    const tree = await this.scanner.scan(input.workspaceRoot, {
      maxDepth: input.maxDepth,
      maxFiles: input.maxFiles,
    });

    const markers = this.markerDetector.detect(tree);
    const units = this.unitDetector.detect(tree, markers);
    const markdown = this.mapBuilder.build({ tree, markers, units });

    const result: ProjectMapResult = {
      rootPath: input.workspaceRoot,
      generatedAt: new Date().toISOString(),
      tree,
      markers,
      units,
      markdown,
    };

    const { filesWritten } = await this.writer.write(input.workspaceRoot, result);

    return { ...result, filesWritten };
  }
}
