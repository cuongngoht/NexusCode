import { describe, expect, it, beforeEach } from 'vitest';
import { NexusStreamNormalizer, type NexusStreamContext } from './NexusStreamNormalizer';
import type { AgentStreamEvent } from './AgentStreamEvent';

const CTX: NexusStreamContext = {
  taskId: 'task_123',
  provider: 'claude',
  mode: 'edit',
  model: 'claude-3-5-sonnet',
};

describe('NexusStreamNormalizer', () => {
  let normalizer: NexusStreamNormalizer;

  beforeEach(() => {
    normalizer = new NexusStreamNormalizer();
  });

  it('maps content_delta to step.delta', () => {
    const event: AgentStreamEvent = { kind: 'content_delta', text: 'Hello world' };
    const result = normalizer.normalize(event, CTX);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'step.delta',
      taskId: CTX.taskId,
      provider: CTX.provider,
      mode: CTX.mode,
      model: CTX.model,
      text: 'Hello world',
    });
    expect(typeof result[0].timestamp).toBe('number');
  });

  it('maps reasoning_delta to step.reasoning', () => {
    const event: AgentStreamEvent = { kind: 'reasoning_delta', text: 'thinking step' };
    const result = normalizer.normalize(event, CTX);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'step.reasoning',
      taskId: CTX.taskId,
      provider: CTX.provider,
      mode: CTX.mode,
      text: 'thinking step',
    });
  });

  it('maps tool_call to tool.started', () => {
    const event: AgentStreamEvent = {
      kind: 'tool_call',
      toolName: 'read_file',
      toolArgs: '{"path":"index.ts"}',
      toolKind: 'read',
    };
    const result = normalizer.normalize(event, CTX);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'tool.started',
      taskId: CTX.taskId,
      provider: CTX.provider,
      mode: CTX.mode,
      model: CTX.model,
      toolName: 'read_file',
      toolKind: 'read',
    });
  });

  it('maps tool_call without toolKind to tool.started with undefined toolKind', () => {
    const event: AgentStreamEvent = {
      kind: 'tool_call',
      toolName: 'some_tool',
      toolArgs: '',
    };
    const result = normalizer.normalize(event, CTX);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'tool.started',
      toolName: 'some_tool',
      toolKind: undefined,
    });
  });

  it('maps tool_result to tool.completed', () => {
    const event: AgentStreamEvent = {
      kind: 'tool_result',
      toolName: 'read_file',
      status: 'done',
      toolKind: 'read',
    };
    const result = normalizer.normalize(event, CTX);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'tool.completed',
      taskId: CTX.taskId,
      provider: CTX.provider,
      mode: CTX.mode,
      model: CTX.model,
      toolName: 'read_file',
      status: 'done',
    });
  });

  it('maps tool_result with error status', () => {
    const event: AgentStreamEvent = {
      kind: 'tool_result',
      toolName: 'bash',
      status: 'error',
    };
    const result = normalizer.normalize(event, CTX);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'tool.completed',
      status: 'error',
      toolName: 'bash',
    });
  });

  it('maps stream_done to empty array', () => {
    const event: AgentStreamEvent = { kind: 'stream_done' };
    const result = normalizer.normalize(event, CTX);
    expect(result).toHaveLength(0);
  });

  it('maps stream_error to stream.warning', () => {
    const event: AgentStreamEvent = { kind: 'stream_error', message: 'connection reset' };
    const result = normalizer.normalize(event, CTX);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'stream.warning',
      taskId: CTX.taskId,
      provider: CTX.provider,
      mode: CTX.mode,
      model: CTX.model,
      message: 'connection reset',
    });
  });

  it('includes all context fields in every event', () => {
    const event: AgentStreamEvent = { kind: 'content_delta', text: 'x' };
    const result = normalizer.normalize(event, CTX);
    const r = result[0];
    expect(r.taskId).toBe(CTX.taskId);
    expect(r.provider).toBe(CTX.provider);
    expect(r.mode).toBe(CTX.mode);
    expect(r.model).toBe(CTX.model);
  });

  it('handles context without model', () => {
    const ctxNoModel: NexusStreamContext = { taskId: 'x', provider: 'grok', mode: 'ask' };
    const event: AgentStreamEvent = { kind: 'content_delta', text: 'hi' };
    const result = normalizer.normalize(event, ctxNoModel);
    expect(result[0]).toMatchObject({ kind: 'step.delta', model: undefined });
  });
});
