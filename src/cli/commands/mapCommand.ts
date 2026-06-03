import * as path from 'path';
import { BuildProjectMapUseCase } from '../../application/usecases/BuildProjectMapUseCase';
import { NexusFileTreeScanner } from '../../context/project-map/NexusFileTreeScanner';
import { NexusMarkerDetector } from '../../context/project-map/NexusMarkerDetector';
import { NexusProjectUnitDetector } from '../../context/project-map/NexusProjectUnitDetector';
import { NexusProjectMapBuilder } from '../../context/project-map/NexusProjectMapBuilder';
import { NexusProjectMapWriter } from '../../context/project-map/NexusProjectMapWriter';

interface MapOptions {
  root: string;
  json: boolean;
  maxDepth: string;
  maxFiles: string;
}

export async function mapCommand(options: MapOptions): Promise<void> {
  const workspaceRoot = path.resolve(options.root);
  const maxDepth = parseInt(options.maxDepth, 10);
  const maxFiles = parseInt(options.maxFiles, 10);
  const asJson = options.json ?? false;

  const useCase = new BuildProjectMapUseCase(
    new NexusFileTreeScanner(),
    new NexusMarkerDetector(),
    new NexusProjectUnitDetector(),
    new NexusProjectMapBuilder(),
    new NexusProjectMapWriter(),
  );

  try {
    const result = await useCase.execute({ workspaceRoot, maxDepth, maxFiles });

    if (asJson) {
      process.stdout.write(JSON.stringify({
        ok: true,
        workspaceRoot: result.rootPath,
        units: result.units.map(u => ({
          id: u.id,
          kind: u.kind,
          languages: u.languages,
        })),
        filesWritten: result.filesWritten,
      }, null, 2) + '\n');
    } else {
      console.log('Nexus Project Map created.\n');
      console.log(`Workspace:\n- ${workspaceRoot}\n`);

      if (result.units.length > 0) {
        console.log('Detected units:');
        for (const unit of result.units) {
          const langs = unit.languages.join(', ') || 'unknown';
          console.log(`- ${unit.name} — ${unit.kind} / ${langs}`);
        }
        console.log('');
      } else {
        console.log('No project units detected.\n');
      }

      console.log('Written:');
      for (const f of result.filesWritten) {
        console.log(`- ${f}`);
      }
    }
  } catch (error) {
    if (asJson) {
      process.stdout.write(JSON.stringify({ ok: false, error: String(error) }, null, 2) + '\n');
    } else {
      console.error(`Error: ${String(error)}`);
    }
    process.exit(1);
  }
}
