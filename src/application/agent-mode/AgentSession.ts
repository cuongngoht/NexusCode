import type { AgentPlan } from './AgentPlan';
import type { AgentStep } from './AgentStep';

export type AgentSessionStatus =
  | 'created'
  | 'scanning'
  | 'planning'
  | 'waiting_approval'
  | 'checkpointing'
  | 'executing'
  | 'testing'
  | 'recovering'
  | 'reviewing'
  | 'collecting_diff'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentSession {
  id: string;
  workspaceRoot: string;
  originalPrompt: string;
  mode: 'agent';
  status: AgentSessionStatus;
  currentStepId?: string;
  providerId: string;
  model?: string;
  plan?: AgentPlan;
  planText?: string;
  approvedAt?: number;
  rejectedAt?: number;
  rejectReason?: string;
  baseBranch?: string;
  workingBranch?: string;
  checkpointIds: string[];
  steps: AgentStep[];
  createdAt: number;
  updatedAt: number;
  error?: string;
}
