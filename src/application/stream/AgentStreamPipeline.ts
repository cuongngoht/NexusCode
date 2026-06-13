import type { IStreamDecoder } from '../../core/stream/IStreamDecoder';
import type { IProviderStreamAdapter } from '../../core/stream/IProviderStreamAdapter';
import type { AgentStreamEvent } from '../../core/stream/AgentStreamEvent';

export class AgentStreamPipeline {
  constructor(
    private readonly decoder: IStreamDecoder,
    private readonly adapter: IProviderStreamAdapter,
  ) {}

  processChunk(chunk: string): AgentStreamEvent[] {
    return this.decoder.decode(chunk).flatMap(f => this.adapter.adapt(f));
  }

  flush(): AgentStreamEvent[] {
    const fromDecoder = this.decoder.flush().flatMap(f => this.adapter.adapt(f));
    const fromAdapter = (this.adapter as { flush?(): AgentStreamEvent[] }).flush?.() ?? [];
    return [...fromDecoder, ...fromAdapter];
  }
}
