import type { AgentCommand } from '../agent/AgentCommand';
import type { AgentResult } from '../agent/AgentResult';

export interface RunOptions {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  cwd?: string;
}

export interface IProcessRunner {
  run(command: AgentCommand, options?: RunOptions): Promise<AgentResult>;
  stop(): Promise<void>;
}
