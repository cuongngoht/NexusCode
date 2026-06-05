import type { AgentTask } from '../core/agent';
import type { AgentResult } from '../core/agent';
import { GptTokenCounter } from './TokenCounter';
import type { TokenRunUsage } from './TokenUsage';

export class TokenMeter {
  private readonly counter = new GptTokenCounter();

  createPreview(task: AgentTask, providerLabel: string, inputPrompt: string): TokenRunUsage {
    const originalPromptTokens = this.counter.countText(task.prompt);
    const enhancedPromptTokens = this.counter.countText(inputPrompt);
    return {
      taskId: task.id,
      provider: task.agentId,
      providerLabel,
      mode: task.mode,
      model: task.model,
      inputTokens: enhancedPromptTokens,
      outputTokens: 0,
      totalTokens: enhancedPromptTokens,
      originalPromptTokens,
      enhancedPromptTokens,
      contextOverheadTokens: Math.max(0, enhancedPromptTokens - originalPromptTokens),
      source: 'estimated',
      tokenizer: 'gpt-tokenizer/o200k_base',
      startedAt: task.startedAt,
    };
  }

  createFinal(task: AgentTask, result: AgentResult, providerLabel: string, inputPrompt: string): TokenRunUsage {
    const originalPromptTokens = this.counter.countText(task.prompt);
    const enhancedPromptTokens = this.counter.countText(inputPrompt);
    const outputTokens = this.counter.countText(`${result.stdout}\n${result.stderr}`);
    return {
      taskId: task.id,
      provider: task.agentId,
      providerLabel,
      mode: task.mode,
      model: task.model,
      inputTokens: enhancedPromptTokens,
      outputTokens,
      totalTokens: enhancedPromptTokens + outputTokens,
      originalPromptTokens,
      enhancedPromptTokens,
      contextOverheadTokens: Math.max(0, enhancedPromptTokens - originalPromptTokens),
      source: 'estimated',
      tokenizer: 'gpt-tokenizer/o200k_base',
      startedAt: task.startedAt,
      completedAt: Date.now(),
    };
  }
}
