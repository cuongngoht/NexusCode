import * as fs from 'fs';
import * as path from 'path';
import { tokenize } from '../../history-search/bm25/Bm25Tokenizer';
import type { ProjectMemoryDocument, ProjectMemoryCorpusStats, ProjectMemorySearchIndex } from './ProjectMemoryDocument';

const MAX_CHUNK_CHARS = 2000;

export class ProjectMemoryIndexBuilder {
  async build(workspaceRoot: string, manifestScanId: string): Promise<ProjectMemorySearchIndex> {
    const documents: ProjectMemoryDocument[] = [];

    this.chunkMarkdownFile(
      path.join(workspaceRoot, '.nexus', 'project-map.md'),
      'project-map',
      documents,
    );

    this.chunkWorkspaceUnits(
      path.join(workspaceRoot, '.nexus', 'workspace-units.json'),
      documents,
    );

    const discoveryDir = path.join(workspaceRoot, '.nexus', 'discovery');
    if (fs.existsSync(discoveryDir)) {
      for (const file of fs.readdirSync(discoveryDir)) {
        if (file.endsWith('.md')) {
          this.chunkMarkdownFile(
            path.join(discoveryDir, file),
            'discovery',
            documents,
          );
        }
      }
    }

    const stats = this.computeStats(documents);

    return {
      version: 1,
      builtAt: Date.now(),
      manifestScanId,
      documents,
      stats,
    };
  }

  private chunkMarkdownFile(
    filePath: string,
    source: ProjectMemoryDocument['source'],
    out: ProjectMemoryDocument[],
  ): void {
    if (!fs.existsSync(filePath)) return;

    const raw = fs.readFileSync(filePath, 'utf8');
    const sections = raw.split(/^## /m);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      const firstNewline = trimmed.indexOf('\n');
      const heading = firstNewline === -1 ? trimmed : trimmed.slice(0, firstNewline).trim();
      const body = firstNewline === -1 ? '' : trimmed.slice(firstNewline).trim();
      const content = (heading + '\n' + body).slice(0, MAX_CHUNK_CHARS);

      const id = `${source}::${heading}`;
      out.push({
        id,
        source,
        section: heading,
        content,
        tokens: tokenize(content),
      });
    }
  }

  private chunkWorkspaceUnits(filePath: string, out: ProjectMemoryDocument[]): void {
    if (!fs.existsSync(filePath)) return;

    let units: unknown[];
    try {
      units = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown[];
    } catch {
      return;
    }

    if (!Array.isArray(units)) return;

    for (const unit of units) {
      if (!unit || typeof unit !== 'object') continue;
      const u = unit as Record<string, unknown>;

      const name = typeof u['name'] === 'string' ? u['name'] : '';
      const kind = typeof u['kind'] === 'string' ? u['kind'] : '';
      const rootPath = typeof u['rootPath'] === 'string' ? u['rootPath'] : '';
      const files = Array.isArray(u['files'])
        ? (u['files'] as unknown[])
            .filter((f): f is string => typeof f === 'string')
            .slice(0, 30)
            .join('\n')
        : '';

      if (!name) continue;

      const content = [`Unit: ${name}`, `Kind: ${kind}`, `Path: ${rootPath}`, files]
        .filter(Boolean)
        .join('\n')
        .slice(0, MAX_CHUNK_CHARS);

      out.push({
        id: `workspace-units::${name}`,
        source: 'workspace-units',
        section: name,
        content,
        tokens: tokenize(content),
      });
    }
  }

  private computeStats(documents: ProjectMemoryDocument[]): ProjectMemoryCorpusStats {
    const totalDocs = documents.length;
    if (totalDocs === 0) {
      return { avgDocLength: 0, docFreq: {}, totalDocs: 0 };
    }

    let totalTokens = 0;
    const docFreq: Record<string, number> = {};

    for (const doc of documents) {
      totalTokens += doc.tokens.length;
      const seen = new Set<string>();
      for (const token of doc.tokens) {
        if (!seen.has(token)) {
          seen.add(token);
          docFreq[token] = (docFreq[token] ?? 0) + 1;
        }
      }
    }

    return {
      avgDocLength: totalTokens / totalDocs,
      docFreq,
      totalDocs,
    };
  }
}
