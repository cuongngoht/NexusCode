export type ProviderId = 'codex' | 'claude' | 'gemini' | 'copilot' | 'aider' | 'custom' | 'auto';

export type TaskMode =
  | 'ask'
  | 'research'
  | 'scan-project'
  | 'plan'
  | 'edit'
  | 'debug'
  | 'test'
  | 'review';

export type ProviderModelSource = 'detected' | 'seeded';

export interface ProviderModel {
  id: string;
  label: string;
  source: ProviderModelSource;
}

export interface NexusTask {
  id: string;
  prompt: string;
  enhancedPrompt: string;
  provider: ProviderId;
  mode: TaskMode;
  model?: string;
  startedAt: number;
  stoppedAt?: number;
  exitCode?: number;
}

export interface CliCommand {
  command: string;
  args: string[];
}

export interface CliRunOptions {
  model?: string;
}

export interface ProviderCapabilities {
  supportsWebSearch: boolean;
  supportsFileEdit: boolean;
  supportsShellExec: boolean;
}

export interface CliProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;
  isAvailable(): Promise<boolean>;
  buildCommand(enhancedPrompt: string, options?: CliRunOptions): CliCommand;
}

export type NexusEventKind =
  | 'task_started'
  | 'stdout'
  | 'stderr'
  | 'task_stopped'
  | 'task_completed'
  | 'task_error'
  | 'git_status';

export interface NexusEvent {
  kind: NexusEventKind;
  taskId: string;
  payload?: unknown;
}

export interface GitFileChange {
  status: string;
  path: string;
}
