import * as fs from 'fs';
import * as path from 'path';
import type { ProjectMapResult } from './types';

const GITIGNORE_CONTENT = `scan-cache.json
file-tree.txt
project-summary.raw.txt
tmp/
*.cache.json
`;

export class NexusProjectMapWriter {
  async write(
    rootPath: string,
    result: ProjectMapResult,
  ): Promise<{ filesWritten: string[] }> {
    const nexusDir = path.join(rootPath, '.nexus');
    fs.mkdirSync(nexusDir, { recursive: true });

    const filesWritten: string[] = [];

    const writeFile = (filename: string, content: string): void => {
      fs.writeFileSync(path.join(nexusDir, filename), content, 'utf8');
      filesWritten.push(path.join('.nexus', filename));
    };

    writeFile('project-map.md', result.markdown);
    writeFile('file-tree.txt', result.tree.files.join('\n'));
    writeFile('workspace-units.json', JSON.stringify(result.units, null, 2));
    writeFile('scan-cache.json', JSON.stringify({
      rootPath: result.rootPath,
      generatedAt: result.generatedAt,
      fileCount: result.tree.files.length,
      folderCount: result.tree.folders.length,
      markerCount: result.markers.length,
    }, null, 2));

    const gitignorePath = path.join(nexusDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, GITIGNORE_CONTENT, 'utf8');
      filesWritten.push('.nexus/.gitignore');
    }

    return { filesWritten };
  }
}
