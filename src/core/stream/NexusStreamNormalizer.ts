import type { AgentStreamEvent } from './AgentStreamEvent';
import type { NexusStreamEvent } from './NexusStreamEvent';

export interface NexusStreamContext {
  taskId: string;
  provider: string;
  mode: string;
  model?: string;
}

export class NexusStreamNormalizer {
  normalize(event: AgentStreamEvent, ctx: NexusStreamContext): NexusStreamEvent[] {
    const base = {
      taskId: ctx.taskId,
      timestamp: Date.now(),
      provider: ctx.provider,
      mode: ctx.mode,
      model: ctx.model,
    };
    switch (event.kind) {
      case 'content_delta':
        return [{ kind: 'step.delta', ...base, text: event.text }];
      case 'tool_call':
        return [{ kind: 'tool.started', ...base, toolName: event.toolName, toolKind: event.toolKind }];
      case 'tool_result':
        return [{ kind: 'tool.completed', ...base, toolName: event.toolName, status: event.status }];
      case 'stream_done':
        return [];
      case 'stream_error':
        return [{ kind: 'stream.warning', ...base, message: event.message }];
    }
  }
}
