import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  KNOWLEDGE_BASE_ENTRIES_DIR,
  KNOWLEDGE_BASE_SCHEMA_VERSION,
  truncatePrompt,
  type KnowledgeBaseEntry,
  type NewKnowledgeBaseEntry,
} from './types';

export class KnowledgeBaseWriter {
  async write(workspaceRoot: string, input: NewKnowledgeBaseEntry): Promise<KnowledgeBaseEntry> {
    const entry: KnowledgeBaseEntry = {
      ...input,
      version: 1,
      schemaVersion: KNOWLEDGE_BASE_SCHEMA_VERSION,
      id: randomUUID(),
      createdAt: Date.now(),
      workspaceRoot,
      originalPrompt: truncatePrompt(input.originalPrompt),
    };

    const dir = path.join(workspaceRoot, KNOWLEDGE_BASE_ENTRIES_DIR);
    await fs.mkdir(dir, { recursive: true });

    const filename = `${entry.createdAt}-${entry.mode}-${entry.id.slice(0, 8)}.json`;
    const target = path.join(dir, filename);
    const tmp = path.join(dir, `${filename}.${process.pid}.${Date.now()}.tmp`);

    await fs.writeFile(tmp, JSON.stringify(entry, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);

    return entry;
  }
}
