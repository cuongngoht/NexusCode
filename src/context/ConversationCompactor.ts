import type { SerializedChatMessage, SerializedConversationCompactSummary } from '../core/chat/ChatHistory';
import type { AgentId } from '../core/agent/AgentTask';
import type { AgentRegistry } from '../application/AgentRegistry';
import type { IProcessRunner } from '../core/runner/IProcessRunner';
import { AgentTask } from '../core/agent/AgentTask';
import { buildCompactPrompt } from './compactPrompt';
import { buildFallbackCompactSummary } from './compactSummaryFormatter';

export class ConversationCompactor {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly runner: IProcessRunner,
  ) { }

  async compact(
    messages: SerializedChatMessage[],
    provider: AgentId,
    model?: string,
    maxChars = 8_000,
  ): Promise<SerializedConversationCompactSummary> {
    const now = Date.now();
    const lastMsg = messages[messages.length - 1];

    let content: string;
    let usedProvider: string | undefined;
    let usedModel: string | undefined;

    try {
      const agent = this.registry.get(provider);
      if (!await agent.isAvailable()) {
        throw new Error(`Provider '${provider}' is not available`);
      }
      const prompt = buildCompactPrompt(messages);
      const task = new AgentTask(prompt, prompt, provider, 'ask', model);
      const command = agent.buildCommand(task);
      const result = await this.runner.run(command);

      if (!result.succeeded || !result.stdout?.trim()) {
        throw new Error(`Compact failed (exit ${result.exitCode}): ${result.stderr}`);
      }

      content = result.stdout.trim().slice(0, maxChars);
      usedProvider = provider;
      usedModel = model ?? agent.defaultModel;
    } catch {
      // Fall back to deterministic summary
      content = buildFallbackCompactSummary(messages).slice(0, maxChars);
    }

    return {
      content,
      createdAt: now,
      updatedAt: now,
      sourceMessageCount: messages.length,
      sourceLastMessageId: lastMsg?.id,
      provider: usedProvider,
      model: usedModel,
    };
  }
}
