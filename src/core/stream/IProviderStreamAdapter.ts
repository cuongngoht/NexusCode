import type { DecodedFrame } from './IStreamDecoder';
import type { AgentStreamEvent } from './AgentStreamEvent';

export interface IProviderStreamAdapter {
  adapt(frame: DecodedFrame): AgentStreamEvent[];
}
