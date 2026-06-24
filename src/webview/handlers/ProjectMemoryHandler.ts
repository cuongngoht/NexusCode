import * as fs from 'fs/promises';
import * as path from 'path';
import type { ExtensionMessage } from '../webviewProtocol';
import { BuildProjectMapUseCase } from '../../application/usecases/BuildProjectMapUseCase';
import {
  FsProjectMemoryManifestRepository,
  FsProjectMemoryIndexRepository,
  PROJECT_MEMORY_DIR,
  ProjectMemoryStatusService,
} from '../../context/project-memory';
import { requireWorkspaceRoot } from './workspaceUtils';

export class ProjectMemoryHandler {
  private _rebuilding = false;

  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly buildProjectMap: BuildProjectMapUseCase,
    private readonly statusService: ProjectMemoryStatusService = new ProjectMemoryStatusService(),
  ) {}

  async getIndex(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;

    try {
      const repo = new FsProjectMemoryIndexRepository();
      const index = await repo.load(workspaceRoot);
      if (!index) {
        this.post({ type: 'projectMemoryIndex', documents: [], totalDocs: 0, avgDocLength: 0, builtAt: 0 });
        return;
      }
      this.post({
        type: 'projectMemoryIndex',
        documents: index.documents.map(d => ({
          id: d.id,
          source: d.source,
          section: d.section,
          content: d.content.slice(0, 400),
        })),
        totalDocs: index.stats.totalDocs,
        avgDocLength: Math.round(index.stats.avgDocLength),
        builtAt: index.builtAt,
      });
    } catch (error) {
      this.post({
        type: 'projectMemoryError',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getStatus(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;

    const result = await this.statusService.getStatus(workspaceRoot);
    this.post({ type: 'projectMemoryStatus', result });
  }

  async rebuild(): Promise<void> {
    if (this._rebuilding) {
      await this.getStatus();
      return;
    }
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;

    this._rebuilding = true;
    try {
      const result = await this.buildProjectMap.execute({ workspaceRoot });
      this.post({
        type: 'projectScanCompleted',
        fileCount: result.tree.files.length,
        folderCount: result.tree.folders.length,
        unitCount: result.units.length,
        filesWritten: result.filesWritten,
      });
      await this.getStatus();
    } catch (error) {
      this.post({
        type: 'projectMemoryError',
        message: error instanceof Error ? error.message : String(error),
      });
      await this.getStatus();
    } finally {
      this._rebuilding = false;
    }
  }

  async clear(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;

    try {
      await new FsProjectMemoryManifestRepository().deleteManifest(workspaceRoot);
      await fs.rm(path.join(workspaceRoot, PROJECT_MEMORY_DIR), { recursive: true, force: true });
      this.post({ type: 'projectMemoryCleared' });
      await this.getStatus();
    } catch (error) {
      this.post({
        type: 'projectMemoryError',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
