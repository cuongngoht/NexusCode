import * as fs from 'fs/promises';
import * as path from 'path';
import { ARCHITECTURE_MEMORY_DIR, type ArchitectureMemory } from './types';

export class ArchitectureMemoryWriter {
  async write(
    workspaceRoot: string,
    memory: ArchitectureMemory,
    markdown: string,
  ): Promise<{ filesWritten: string[] }> {
    const dir = path.join(workspaceRoot, ARCHITECTURE_MEMORY_DIR);
    await fs.mkdir(dir, { recursive: true });

    const filesWritten: string[] = [];

    const toWrite: Array<{ name: string; content: string }> = [
      { name: 'architecture.json', content: JSON.stringify(memory, null, 2) + '\n' },
      { name: 'architecture.md', content: markdown },
      { name: 'dependency-graph.json', content: JSON.stringify(memory.graph, null, 2) + '\n' },
      { name: 'violations.json', content: JSON.stringify(memory.violations, null, 2) + '\n' },
    ];

    for (const { name, content } of toWrite) {
      const target = path.join(dir, name);
      const tmp = path.join(dir, `${name}.${process.pid}.${Date.now()}.tmp`);
      await fs.writeFile(tmp, content, 'utf8');
      await fs.rename(tmp, target);
      filesWritten.push(target);
    }

    return { filesWritten };
  }
}
