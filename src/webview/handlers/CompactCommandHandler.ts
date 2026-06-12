import type { SerializedChatMessage } from '../../core/chat/ChatHistory';
import type { ProviderId } from '../../core/types';
import type { AgentId } from '../../core/agent/AgentTask';
import type { ExtensionMessage } from '../webviewProtocol';
import type { ConversationCompactor } from '../../context/ConversationCompactor';

export class CompactCommandHandler {
  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly compactor: ConversationCompactor | undefined,
  ) { }

  async handle(
    conversationId: string,
    messages: SerializedChatMessage[],
    provider: ProviderId,
    model?: string,
  ): Promise<void> {
    if (!this.compactor) {
      this.post({
        type: 'compactSummaryError',
        conversationId,
        message: 'Compact is not available in this environment.',
      });
      return;
    }

    if (messages.length === 0) {
      this.post({
        type: 'compactSummaryError',
        conversationId,
        message: 'No messages to compact.',
      });
      return;
    }

    this.post({ type: 'compactStarted', conversationId });

    try {
      const summary = await this.compactor.compact(
        messages,
        provider as AgentId,
        model,
      );
      this.post({ type: 'compactSummaryUpdated', conversationId, summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.post({ type: 'compactSummaryError', conversationId, message });
    }
  }
}
