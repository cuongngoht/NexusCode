import * as fs from 'fs';
import * as path from 'path';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { NexusEvent } from '../../core/events/IEventBus';

export class BrainstormAgentsStep implements IPipelineStep {
  readonly label = 'prepare-brainstorm-agents';

  constructor(private readonly extensionPath: string) {}

  async execute(ctx: PipelineContext, _emit: (e: NexusEvent) => void): Promise<void> {
    const targetDir = path.join(ctx.workspaceRoot, '.nexus', 'agents', 'brainstorm');
    fs.mkdirSync(targetDir, { recursive: true });

    const sourceDir = path.join(this.extensionPath, 'media', 'agents', 'brainstorm');
    if (fs.existsSync(sourceDir)) {
      for (const file of fs.readdirSync(sourceDir).filter((f: string) => f.endsWith('.md'))) {
        const dest = path.join(targetDir, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(path.join(sourceDir, file), dest);
        }
      }
    }

    const files = fs.readdirSync(targetDir).filter((f: string) => f.endsWith('.md')).sort();
    const sections = files.map((file: string) => {
      const content = fs.readFileSync(path.join(targetDir, file), 'utf8');
      return `## File: .nexus/agents/brainstorm/${file}\n\n${content.trim()}`;
    });

    ctx.brainstormAgents = sections.join('\n\n---\n\n');
  }
}
