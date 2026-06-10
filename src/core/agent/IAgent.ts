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
}
