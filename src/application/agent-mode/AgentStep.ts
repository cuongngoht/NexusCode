export type AgentStepType =
  | 'scan_project'
  | 'load_rules'
  | 'load_context'
  | 'research_repo'
  | 'plan'
  | 'approval'
  | 'checkpoint'
  | 'edit'
  | 'run_tests'
  | 'fix_tests'
  | 'review'
  | 'update_docs'
  | 'collect_diff'
  | 'final_summary';

export type AgentStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface AgentStep {
  id: string;
  sessionId: string;
  type: AgentStepType;
  title: string;
  status: AgentStepStatus;
  startedAt?: number;
  completedAt?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}
