import * as fs from 'fs/promises';
import * as path from 'path';
import {
  KNOWLEDGE_BASE_ENTRIES_DIR,
  KNOWLEDGE_BASE_SCHEMA_VERSION,
  type KnowledgeBaseEntry,
} from './types';

const DEFAULT_LIMIT = 500;

export class KnowledgeBaseLoader {
  async loadRecentEntries(
    workspaceRoot: string,
    opts: { limit?: number } = {},
  ): Promise<KnowledgeBaseEntry[]> {
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const dir = path.join(workspaceRoot, KNOWLEDGE_BASE_ENTRIES_DIR);

    let filenames: string[];
    try {
      filenames = await fs.readdir(dir);
    } catch {
      return [];
    }

    // Epoch-ms filename prefix keeps this sortable without per-file stat() calls.
    const jsonFiles = filenames.filter(f => f.endsWith('.json')).sort().reverse().slice(0, limit);

    const entries: KnowledgeBaseEntry[] = [];
    for (const filename of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(dir, filename), 'utf8');
        const parsed: unknown = JSON.parse(content);
        if (isValidEntryShape(parsed)) {
          entries.push(parsed);
        }
      } catch {
        // Skip corrupt/partial entry files — never let one bad file break retrieval.
      }
    }

    return entries;
  }
}

function isValidEntryShape(value: unknown): value is KnowledgeBaseEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    e['version'] === 1 &&
    e['schemaVersion'] === KNOWLEDGE_BASE_SCHEMA_VERSION &&
    typeof e['id'] === 'string' &&
    typeof e['createdAt'] === 'number' &&
    typeof e['mode'] === 'string' &&
    typeof e['originalPrompt'] === 'string' &&
    Array.isArray(e['changedFiles'])
  );
}
