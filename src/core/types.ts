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

export interface GitFileChange {
  status: string;
  path: string;
}
