export type ProviderId = 'nexus' | 'codex' | 'claude' | 'antigravity' | 'copilot' | 'aider' | 'custom' | 'grok' | 'auto';

export type TaskMode =
  | 'ask'
  | 'research'
  | 'scan-project'
  | 'plan'
  | 'brainstorm'
  | 'edit'
  | 'debug'
  | 'test'
  | 'review'
  | 'agent';

export type ProviderModelSource = 'detected' | 'seeded' | 'configured' | 'cached';

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

export type CodeReviewTargetType =
  | 'working-tree'
  | 'staged'
  | 'branch'
  | 'commit'
  | 'file'
  | 'selection';

export interface CodeReviewTarget {
  type: CodeReviewTargetType;
  baseBranch?: string;
  compareBranch?: string;
  commitSha?: string;
  filePath?: string;
  selectedText?: string;
}

export interface PromptAttachment {
  type: 'file' | 'folder';
  /** Workspace-relative path — never absolute, never contains `..` */
  path: string;
}

export interface SubagentContextEntry {
  role: string;
  compactOutput: string;
  error?: string;
}
