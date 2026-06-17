import type { AgentCapabilities } from './AgentCapabilities';
import type { AgentCommand } from './AgentCommand';
import type { AgentOutput } from './AgentOutput';
import type { AgentTask, AgentId } from './AgentTask';
import type { IOutputParser } from './IOutputParser';
import type { ProviderModel } from '../types';

export interface IAgent {
  readonly id: AgentId;
  readonly displayName: string;
  readonly capabilities: AgentCapabilities;
  readonly seededModels: ReadonlyArray<ProviderModel>;
  readonly defaultModel?: string;
  readonly outputParser?: IOutputParser;
  isAvailable(): Promise<boolean>;
  isLoggedIn?(): Promise<boolean>;
  buildCommand(task: AgentTask): AgentCommand;
  parseOutput(raw: string): AgentOutput;
  transformStdout?(chunk: string): string;
  // Modes where raw stdout should NOT be streamed into the chat message.
  // Agents that output structured content (e.g. JSON) in specific modes can declare
  // those modes here so the UI shows only the structured panel, not raw tokens.
  readonly suppressChatStreamModes?: ReadonlyArray<string>;
}
