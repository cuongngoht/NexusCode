export type DebugSignalKind =
  | 'stack-trace'
  | 'terminal-output'
  | 'build-error'
  | 'type-error'
  | 'test-failure'
  | 'bug-report'
  | 'unknown';

export interface DebugFileRef {
  path: string;
  line?: number;
  column?: number;
}

export interface DebugSignal {
  raw: string;
  kind: DebugSignalKind;
  files: DebugFileRef[];
  command?: string;
  suspectedTools: string[];
  confidence: number;
}

export interface DebugContext {
  signal: DebugSignal;
  selectedFiles: string[];
  failingCommand?: string;
  packageScripts: Record<string, string>;
  gitChangedFiles: string[];
  noEdit: boolean;
  addRegressionTest: boolean;
  rerunAfterFix: boolean;
  checkpoint: boolean;
  asyncMode: boolean;
}
