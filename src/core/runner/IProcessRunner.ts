import type { AgentCommand } from '../agent/AgentCommand';
import type { AgentResult } from '../agent/AgentResult';

export interface RunOptions {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  cwd?: string;
  /**
   * If no stdout or stderr arrives within this many milliseconds, the process
   * is killed and the run resolves with the output accumulated so far.
   * Default: no idle timeout (process can run indefinitely).
   */
  idleTimeoutMs?: number;
}

export interface IProcessRunner {
  run(command: AgentCommand, options?: RunOptions): Promise<AgentResult>;
  stop(): Promise<void>;
}
