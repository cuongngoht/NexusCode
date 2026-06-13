import type { ChatHistoryState } from '../../../core/chat/ChatHistory';
import type { SearchDocument, SerializedHistorySearchIndex } from '../types';
import { HistoryDocumentMapper } from './HistoryDocumentMapper';

export class HistoryIndexBuilder {
  private readonly mapper = new HistoryDocumentMapper();

  build(history: ChatHistoryState): SerializedHistorySearchIndex {
    const documents: SearchDocument[] = history.conversations.flatMap(c =>
      this.mapper.map(c),
    );

    const totalDocs = documents.length;
    const avgDocLength =
      totalDocs > 0
        ? documents.reduce((sum, d) => sum + d.tokens.length, 0) / totalDocs
        : 0;

    // Compute document frequency: for each unique term in a document, count it once
    const docFreq: Record<string, number> = {};
    for (const doc of documents) {
      const uniqueTerms = new Set(doc.tokens);
      for (const term of uniqueTerms) {
        docFreq[term] = (docFreq[term] ?? 0) + 1;
      }
    }

    return {
      version: 1,
      builtAt: Date.now(),
      sourceHistoryHash: this.hash(history),
      documentCount: totalDocs,
      documents,
      stats: { avgDocLength, docFreq, totalDocs },
    };
  }

  hash(history: ChatHistoryState): string {
    const count = history.conversations.reduce(
      (sum, c) => sum + c.messages.length,
      0,
    );
    const latest = history.conversations.reduce(
      (max, c) => Math.max(max, c.updatedAt),
      0,
    );
    return `${history.conversations.length}:${count}:${latest}`;
  }
}
