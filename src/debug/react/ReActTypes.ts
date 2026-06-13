/**
 * ReAct action types for debug investigation.
 *
 * IMPORTANT: edit_file, apply_patch, delete_file, install_package,
 * git_reset, git_clean are intentionally ABSENT — the investigation
 * phase must never mutate the workspace.
 */
export type ReActAction =
  | { type: 'read_file'; path: string; startLine?: number; endLine?: number }
  | { type: 'search_text'; query: string; paths?: string[] }
  | { type: 'list_related_files'; path: string }
  | { type: 'run_diagnostic_command'; command: string };

export interface ReActThought {
  round: number;
  thought: string;
}

export interface ReActObservation {
  round: number;
  action: ReActAction;
  observation: string;
}

export interface ReActResult {
  evidence: string[];
  suspectedRootCause?: string;
  confidence: number;
}
