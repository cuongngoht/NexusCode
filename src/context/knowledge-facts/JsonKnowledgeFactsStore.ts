import * as fs from 'fs/promises';
import * as path from 'path';
import {
  KNOWLEDGE_FACTS_DIR,
  isValidKnowledgeFactShape,
  isValidKnowledgeFactsIndexShape,
  type KnowledgeFact,
  type KnowledgeFactsIndex,
  type KnowledgeFactsIndexEntry,
} from './types';
import type { IKnowledgeFactsStore } from './KnowledgeFactsStore';

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

/**
 * One file per fact, keyed by canonicalKey (not fact id) — re-deriving the same key always maps
 * to the same file, enabling atomic upsert-by-key. This differs from KnowledgeBaseWriter's
 * append-only entries/ journal, which has no such key concept.
 */
export class JsonKnowledgeFactsStore implements IKnowledgeFactsStore {
  private dir(workspaceRoot: string): string {
    return path.join(workspaceRoot, KNOWLEDGE_FACTS_DIR);
  }

  private factPath(workspaceRoot: string, canonicalKey: string): string {
    return path.join(this.dir(workspaceRoot), `${canonicalKey}.json`);
  }

  private indexPath(workspaceRoot: string): string {
    return path.join(this.dir(workspaceRoot), 'index.json');
  }

  async read(workspaceRoot: string, canonicalKey: string): Promise<KnowledgeFact | undefined> {
    try {
      const content = await fs.readFile(this.factPath(workspaceRoot, canonicalKey), 'utf8');
      const parsed: unknown = JSON.parse(content);
      return isValidKnowledgeFactShape(parsed) ? parsed : undefined;
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') return undefined;
      return undefined;
    }
  }

  async write(workspaceRoot: string, fact: KnowledgeFact): Promise<void> {
    const dir = this.dir(workspaceRoot);
    await fs.mkdir(dir, { recursive: true });

    const target = this.factPath(workspaceRoot, fact.canonicalKey);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(fact, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);

    await this.upsertIndexEntry(workspaceRoot, {
      id: fact.id,
      canonicalKey: fact.canonicalKey,
      kind: fact.kind,
      status: fact.status,
      updatedAt: fact.updatedAt,
    });
  }

  async delete(workspaceRoot: string, canonicalKey: string): Promise<void> {
    try {
      await fs.unlink(this.factPath(workspaceRoot, canonicalKey));
    } catch (err) {
      if (!isNodeError(err) || err.code !== 'ENOENT') throw err;
    }

    const index = await this.readIndex(workspaceRoot);
    if (index) {
      index.facts = index.facts.filter(f => f.canonicalKey !== canonicalKey);
      index.updatedAt = Date.now();
      await this.writeIndex(workspaceRoot, index);
    }
  }

  async readIndex(workspaceRoot: string): Promise<KnowledgeFactsIndex | undefined> {
    try {
      const content = await fs.readFile(this.indexPath(workspaceRoot), 'utf8');
      const parsed: unknown = JSON.parse(content);
      return isValidKnowledgeFactsIndexShape(parsed) ? parsed : undefined;
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') return undefined;
      return undefined;
    }
  }

  async writeIndex(workspaceRoot: string, index: KnowledgeFactsIndex): Promise<void> {
    const dir = this.dir(workspaceRoot);
    await fs.mkdir(dir, { recursive: true });

    const target = this.indexPath(workspaceRoot);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(index, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);
  }

  async listAll(workspaceRoot: string): Promise<KnowledgeFactsIndexEntry[]> {
    const index = await this.readIndex(workspaceRoot);
    if (index) return index.facts;

    // Fallback: scan directory (no index yet, or index lost/corrupted)
    try {
      const entries = await fs.readdir(this.dir(workspaceRoot));
      const facts: KnowledgeFactsIndexEntry[] = [];
      for (const entry of entries) {
        if (!entry.endsWith('.json') || entry === 'index.json') continue;
        const canonicalKey = entry.slice(0, -5);
        const fact = await this.read(workspaceRoot, canonicalKey);
        if (fact) {
          facts.push({ id: fact.id, canonicalKey: fact.canonicalKey, kind: fact.kind, status: fact.status, updatedAt: fact.updatedAt });
        }
      }
      return facts;
    } catch {
      return [];
    }
  }

  private async upsertIndexEntry(workspaceRoot: string, entry: KnowledgeFactsIndexEntry): Promise<void> {
    const index = (await this.readIndex(workspaceRoot)) ?? { version: 1 as const, updatedAt: Date.now(), facts: [] };
    index.facts = [...index.facts.filter(f => f.canonicalKey !== entry.canonicalKey), entry];
    index.updatedAt = Date.now();
    await this.writeIndex(workspaceRoot, index);
  }
}
