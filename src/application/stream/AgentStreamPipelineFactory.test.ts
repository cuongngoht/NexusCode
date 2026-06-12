import { describe, expect, it } from 'vitest';
import { AgentStreamPipelineFactory } from './AgentStreamPipelineFactory';
import { AgentCommand } from '../../core/agent/AgentCommand';
import { SseDecoder } from '../../infrastructure/stream/SseDecoder';
import { LineDecoder } from '../../infrastructure/stream/LineDecoder';
import { PlainTextDecoder } from '../../infrastructure/stream/PlainTextDecoder';

function cmd(transport?: ConstructorParameters<typeof AgentCommand>[5]) {
  return new AgentCommand('mycli', [], undefined, undefined, undefined, transport);
}

describe('AgentStreamPipelineFactory', () => {
  it('returns null when transport is undefined (legacy path)', () => {
    expect(AgentStreamPipelineFactory.create(cmd(undefined))).toBeNull();
  });

  it('returns a pipeline for transport=sse', () => {
    const pipeline = AgentStreamPipelineFactory.create(cmd('sse'));
    expect(pipeline).not.toBeNull();
  });

  it('returns a pipeline for transport=jsonl', () => {
    const pipeline = AgentStreamPipelineFactory.create(cmd('jsonl'));
    expect(pipeline).not.toBeNull();
  });

  it('returns a pipeline for transport=plain', () => {
    const pipeline = AgentStreamPipelineFactory.create(cmd('plain'));
    expect(pipeline).not.toBeNull();
  });

  it('returns a pipeline for transport=stdio', () => {
    const pipeline = AgentStreamPipelineFactory.create(cmd('stdio'));
    expect(pipeline).not.toBeNull();
  });

  it('sse pipeline correctly decodes an SSE chunk end-to-end', () => {
    const pipeline = AgentStreamPipelineFactory.create(cmd('sse'))!;
    const events = pipeline.processChunk(
      'data: {"choices":[{"delta":{"content":"test"},"finish_reason":null}]}\n\n'
    );
    expect(events).toEqual([{ kind: 'content_delta', text: 'test' }]);
  });

  it('jsonl pipeline emits content_delta for a complete line (non-codex executable)', () => {
    const pipeline = AgentStreamPipelineFactory.create(cmd('jsonl'))!;
    const events = pipeline.processChunk('hello world\n');
    expect(events).toEqual([{ kind: 'content_delta', text: 'hello world' }]);
  });

  it('jsonl pipeline uses CodexJsonlAdapter for codex executable', () => {
    const codexCmd = new AgentCommand('codex', [], undefined, undefined, undefined, 'jsonl');
    const pipeline = AgentStreamPipelineFactory.create(codexCmd)!;

    const events = pipeline.processChunk(
      '{"type":"item.completed","item":{"type":"agent_message","text":"Done."}}\n' +
      '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}\n'
    );

    expect(events).toEqual([
      { kind: 'content_delta', text: 'Done.' },
      { kind: 'stream_done' },
    ]);
  });

  it('codex jsonl pipeline handles a JSONL line split across chunks', () => {
    const codexCmd = new AgentCommand('codex', [], undefined, undefined, undefined, 'jsonl');
    const pipeline = AgentStreamPipelineFactory.create(codexCmd)!;

    const e1 = pipeline.processChunk('{"type":"item.completed","item":{"type":"agent_mess');
    expect(e1).toHaveLength(0);

    const e2 = pipeline.processChunk('age","text":"Split."}}\n');
    expect(e2).toEqual([{ kind: 'content_delta', text: 'Split.' }]);
  });

  it('plain pipeline emits content_delta for raw chunk', () => {
    const pipeline = AgentStreamPipelineFactory.create(cmd('plain'))!;
    const events = pipeline.processChunk('raw text');
    expect(events).toEqual([{ kind: 'content_delta', text: 'raw text' }]);
  });
});
