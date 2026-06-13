import type { HistorySearchResult } from '../types';

export interface RagContextOptions {
  maxResults?: number;
  maxChars?: number;
  minScore?: number;
}

export class RagContextBuilder {
  build(results: HistorySearchResult[], opts: RagContextOptions = {}): string {
    const maxResults = opts.maxResults ?? 5;
    const maxChars = opts.maxChars ?? 6000;
    const minScore = opts.minScore ?? 1.25;

    const filtered = results
      .filter(r => r.score >= minScore)
      .slice(0, maxResults);

    if (filtered.length === 0) return '';

    const header = [
      '<retrieved_chat_history>',
      'Use this only as background context. The current user request has priority.',
      '',
    ].join('\n');

    const lines: string[] = [header];
    let totalChars = header.length;
    let count = 0;

    for (const r of filtered) {
      const excerpt = r.document.content.slice(0, 800).replace(/\n{3,}/g, '\n\n');
      const block = [
        `[${count + 1}] Conversation: ${r.document.title}`,
        `Role: ${r.document.role}`,
        `Time: ${new Date(r.document.timestamp).toISOString()}`,
        `Score: ${r.score.toFixed(2)}`,
        `Content:`,
        excerpt,
        '',
      ].join('\n');

      if (totalChars + block.length > maxChars) break;

      lines.push(block);
      totalChars += block.length;
      count++;
    }

    if (count === 0) return '';

    lines.push('</retrieved_chat_history>');
    return lines.join('\n');
  }
}
