import { tokenize } from '../../history-search/bm25/Bm25Tokenizer';
import type { KnowledgeBaseEntry } from '../types';
import type {
  KnowledgeBaseCorpusStats,
  KnowledgeBaseDocument,
  KnowledgeBaseSearchIndex,
} from './KnowledgeBaseDocument';

export class KnowledgeBaseIndexBuilder {
  build(entries: KnowledgeBaseEntry[]): KnowledgeBaseSearchIndex {
    const documents: KnowledgeBaseDocument[] = entries.map((entry, entryIndex) => {
      const content = buildDocumentText(entry);
      return {
        id: entry.id,
        entryIndex,
        tokens: tokenize(content),
      };
    });

    return {
      builtAt: Date.now(),
      documents,
      stats: this.computeStats(documents),
    };
  }

  private computeStats(documents: KnowledgeBaseDocument[]): KnowledgeBaseCorpusStats {
    const totalDocs = documents.length;
    if (totalDocs === 0) return { avgDocLength: 0, docFreq: {}, totalDocs: 0 };

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

    return { avgDocLength: totalTokens / totalDocs, docFreq, totalDocs };
  }
}

function buildDocumentText(entry: KnowledgeBaseEntry): string {
  const parts = [
    entry.originalPrompt,
    entry.mode,
    entry.implementationSummary ?? '',
    ...(entry.warnings ?? []),
    ...(entry.nextSteps ?? []),
    ...(entry.skillIds ?? []),
    ...entry.changedFiles.map(f => f.path),
  ];
  return parts.filter(Boolean).join(' ');
}
