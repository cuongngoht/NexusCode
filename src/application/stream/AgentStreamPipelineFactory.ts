import type { AgentCommand } from '../../core/agent/AgentCommand';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';
import type { DecodedFrame, IStreamDecoder } from '../../core/stream/IStreamDecoder';
import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import { AgentStreamPipeline } from './AgentStreamPipeline';
import { SseDecoder } from '../../infrastructure/stream/SseDecoder';
import { LineDecoder } from '../../infrastructure/stream/LineDecoder';
import { PlainTextDecoder } from '../../infrastructure/stream/PlainTextDecoder';
import { CodexSseAdapter } from '../../providers/codex/CodexSseAdapter';
import { CodexJsonlAdapter } from '../../providers/codex/CodexJsonlAdapter';
import { GrokStreamAdapter } from '../../providers/grok/GrokStreamAdapter';
import { AntigravityStreamAdapter } from '../../providers/antigravity/AntigravityStreamAdapter';

class PlainTextAdapter implements IProviderStreamAdapter {
  adapt(frame: DecodedFrame): AgentStreamEvent[] {
    const text = frame.data;
    if (text.length === 0) return [];
    return [{ kind: 'content_delta', text }];
  }
}

type AdapterFactory = (command: AgentCommand) => { decoder: IStreamDecoder; adapter: IProviderStreamAdapter };

const adapterFactories = new Map<string, AdapterFactory>();

function seedBuiltins() {
  const builtins: Array<[string, AdapterFactory]> = [
    ['sse', () => ({ decoder: new SseDecoder(), adapter: new CodexSseAdapter() })],
    ['jsonl', (cmd) => ({
      decoder: new LineDecoder(),
      adapter: cmd.executable === 'codex' ? new CodexJsonlAdapter() : new PlainTextAdapter(),
    })],
    ['plain', () => ({ decoder: new PlainTextDecoder(), adapter: new PlainTextAdapter() })],
    ['stdio', () => ({ decoder: new LineDecoder(), adapter: new PlainTextAdapter() })],
    ['grok', () => ({ decoder: new LineDecoder(), adapter: new GrokStreamAdapter() })],
    ['antigravity', () => ({ decoder: new LineDecoder(), adapter: new AntigravityStreamAdapter() })],
  ];
  for (const [t, f] of builtins) {
    if (!adapterFactories.has(t)) adapterFactories.set(t, f);
  }
}
seedBuiltins();

export class AgentStreamPipelineFactory {
  /**
   * Register (or override) a transport → (decoder + adapter) factory.
   * This enables Open/Closed Principle: new providers can extend streaming support
   * without modifying this factory's source.
   *
   * Call once early (top of the provider module or in composition root).
   */
  static register(transport: string, factory: AdapterFactory): void {
    adapterFactories.set(transport, factory);
  }

  static create(command: AgentCommand): AgentStreamPipeline | null {
    if (!command.transport) return null;

    const factory = adapterFactories.get(command.transport);
    if (!factory) {
      // Unknown transport — caller will still receive raw 'stdout' events.
      return null;
    }

    const { decoder, adapter } = factory(command);
    return new AgentStreamPipeline(decoder, adapter);
  }
}
