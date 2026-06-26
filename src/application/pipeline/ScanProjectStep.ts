import * as fs from 'fs';
import * as path from 'path';
import type { ICompensableStep } from '../../core/pipeline/ICompensableStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';

export class ScanProjectStep implements ICompensableStep {
  readonly label = 'scan';

  constructor(private readonly extensionPath: string) {}

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    // Prefer workspace-local custom discovery if user has set one up
    const workspaceDiscovery = path.join(ctx.workspaceRoot, '.nexus', 'discovery');
    const bundledDiscovery = path.join(this.extensionPath, 'media', 'discovery');
    const sourceDir = fs.existsSync(path.join(workspaceDiscovery, 'index.md'))
      ? workspaceDiscovery
      : bundledDiscovery;

    const sections: string[] = [];

    const indexPath = path.join(sourceDir, 'index.md');
    if (fs.existsSync(indexPath)) {
      sections.push(fs.readFileSync(indexPath, 'utf8').trim());
    }

    const stepsDir = path.join(sourceDir, 'steps');
    if (fs.existsSync(stepsDir)) {
      const stepFiles = fs.readdirSync(stepsDir)
        .filter((f: string) => f.endsWith('.md'))
        .sort();
      for (const file of stepFiles) {
        const content = fs.readFileSync(path.join(stepsDir, file), 'utf8').trim();
        if (content) {
          sections.push(`## Step: ${file.replace('.md', '')}\n\n${content}`);
        }
      }
    }

    ctx.projectMap = sections.join('\n\n---\n\n');
  }

  async compensate(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    ctx.projectMap = undefined;
  }
}
