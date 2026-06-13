import type { ExtensionMessage } from '../webviewProtocol';
import type { ChatHistoryState } from '../../core/chat/ChatHistory';
import type { HistoryRagFacade } from '../../context/history-search/HistoryRagFacade';
import type { HistorySearchResultView } from '../../context/history-search/types';

export class HistorySearchHandler {
  constructor(
    private readonly facade: HistoryRagFacade,
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly getHistory: () => ChatHistoryState | null,
  ) {}

  async ensureIndex(): Promise<void> {
    const history = this.getHistory();
    if (!history) return;
    try {
      await this.facade.rebuildIndex(history);
      const status = this.facade.getIndexStatus();
      if (status.builtAt) {
        this.post({
          type: 'historySearchIndexReady',
          documentCount: status.documentCount,
          builtAt: status.builtAt,
        });
      }
    } catch {
      // Non-blocking: index build failures should not surface as errors in the UI
    }
  }

  async handleSearch(query: string, limit?: number): Promise<void> {
    const history = this.getHistory();
    if (!history) {
      this.post({ type: 'historySearchError', message: 'No history available.' });
      return;
    }
    try {
      await this.facade.rebuildIndex(history); // ensure up to date
      const results = this.facade.searchHistory({ text: query, limit });
      const views: HistorySearchResultView[] = results.map(r => ({
        id: r.document.id,
        conversationId: r.document.conversationId,
        conversationTitle: r.document.title,
        role: r.document.role,
        excerpt: r.document.content.slice(0, 300),
        score: r.score,
        timestamp: r.document.timestamp,
        mode: r.document.mode,
        provider: r.document.provider,
        matchedTerms: r.matchedTerms,
      }));
      this.post({ type: 'historySearchResults', query, results: views });
    } catch (err) {
      this.post({ type: 'historySearchError', message: String(err) });
    }
  }

  handleClear(): void {
    this.facade.clearIndex();
    this.post({ type: 'historySearchIndexCleared' });
  }
}
