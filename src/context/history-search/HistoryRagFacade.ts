import type { ChatHistoryState } from '../../core/chat/ChatHistory';
import type { HistorySearchQuery, HistorySearchResult, HistoryIndexStatus } from './types';
import type { HistorySearchService } from './HistorySearchService';
import type { RagContextBuilder, RagContextOptions } from './rag/RagContextBuilder';
import type { RagPromptInjector } from './rag/RagPromptInjector';

export class HistoryRagFacade {
  constructor(
    private readonly service: HistorySearchService,
    private readonly ragBuilder: RagContextBuilder,
    private readonly injector: RagPromptInjector,
  ) {}

  searchHistory(query: HistorySearchQuery): HistorySearchResult[] {
    return this.service.search(query);
  }

  async rebuildIndex(history: ChatHistoryState): Promise<void> {
    await this.service.rebuildIndex(history);
  }

  async buildRagForPrompt(
    prompt: string,
    history: ChatHistoryState,
    options: RagContextOptions & { excludeConversationId?: string } = {},
  ): Promise<{ ragContext: string; results: HistorySearchResult[] }> {
    await this.service.ensureIndex(history);

    const results = this.service.search({
      text: prompt,
      limit: options.maxResults ?? 5,
      conversationId: options.excludeConversationId,
      includeCurrentConversation: false,
    });

    const ragContext = this.ragBuilder.build(results, options);
    return { ragContext, results };
  }

  clearIndex(): void {
    this.service.clearIndex();
  }

  getIndexStatus(): HistoryIndexStatus {
    return this.service.getIndexStatus();
  }
}
