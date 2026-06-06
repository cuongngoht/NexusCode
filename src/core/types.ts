export type ProviderId = 'nexus' | 'codex' | 'claude' | 'gemini' | 'copilot' | 'aider' | 'custom' | 'auto';

export type TaskMode =
  | 'ask'
  | 'research'
  | 'scan-project'
  | 'plan'
  | 'brainstorm'
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

export interface GitReviewFileChange {
  status: string;
  path: string;
}

export interface GitReviewContext {
  baseBranch: string;
  compareBranch: string;
  currentBranch: string;
  availableBranches: string[];
  changedFiles: GitReviewFileChange[];
  diffStat: string;
  diff: string;
  diffTruncated: boolean;
  message?: string;
}
