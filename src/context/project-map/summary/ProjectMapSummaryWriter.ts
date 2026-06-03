import * as fs from 'fs/promises';
import * as path from 'path';
import type { ProjectMapAiSummary } from './types';

const NEXUS_DIR = '.nexus';

export class ProjectMapSummaryWriter {
  async readProjectMap(root: string): Promise<string> {
    return fs.readFile(path.join(root, NEXUS_DIR, 'project-map.md'), 'utf-8');
  }

  async readFileTree(root: string): Promise<string> {
    return fs.readFile(path.join(root, NEXUS_DIR, 'file-tree.txt'), 'utf-8');
  }

  async readWorkspaceUnits(root: string): Promise<string> {
    return fs.readFile(path.join(root, NEXUS_DIR, 'workspace-units.json'), 'utf-8');
  }

  async writeSummaryJson(root: string, summary: ProjectMapAiSummary): Promise<void> {
    await fs.writeFile(
      path.join(root, NEXUS_DIR, 'project-summary.json'),
      JSON.stringify(summary, null, 2),
      'utf-8',
    );
  }

  async writeProjectMap(root: string, markdown: string): Promise<void> {
    await fs.writeFile(path.join(root, NEXUS_DIR, 'project-map.md'), markdown, 'utf-8');
  }

  async writeRawDebug(root: string, raw: string): Promise<void> {
    await fs.writeFile(
      path.join(root, NEXUS_DIR, 'project-summary.raw.txt'),
      raw,
      'utf-8',
    );
  }
}
