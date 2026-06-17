import type { AgentSession } from './AgentSession';
import type { AgentStep } from './AgentStep';
import type { AgentPlan } from './AgentPlan';
import type { AgentCommandApprovalRequest } from './AgentCommandGuard';
import type { AgentTestResult } from './AgentTestRunner';
import type { AgentRecoveryResult } from './AgentRecovery';
import type { AgentReviewResult } from './AgentReviewRunner';
import type { AgentDiffSummary } from './AgentDiffCollector';
import type { AgentFinalSummary } from './AgentFinalReporter';

export type AgentModeEvent =
  | {
      kind: 'agent_session_created';
      session: AgentSession;
    }
  | {
      kind: 'agent_session_updated';
      session: AgentSession;
    }
  | {
      kind: 'agent_step_started';
      sessionId: string;
      step: AgentStep;
    }
  | {
      kind: 'agent_step_completed';
      sessionId: string;
      step: AgentStep;
    }
  | {
      kind: 'agent_step_failed';
      sessionId: string;
      step: AgentStep;
      error: string;
    }
  | {
      kind: 'agent_plan_ready_for_approval';
      sessionId: string;
      plan: AgentPlan;
      planText: string;
    }
  | {
      kind: 'agent_plan_approved';
      sessionId: string;
    }
  | {
      kind: 'agent_plan_rejected';
      sessionId: string;
      reason?: string;
    }
  | {
      kind: 'agent_checkpoint_created';
      sessionId: string;
      checkpointId: string;
    }
  | {
      kind: 'agent_command_approval_requested';
      sessionId: string;
      request: AgentCommandApprovalRequest;
    }
  | {
      kind: 'agent_test_result';
      sessionId: string;
      result: AgentTestResult;
    }
  | {
      kind: 'agent_recovery_result';
      sessionId: string;
      result: AgentRecoveryResult;
    }
  | {
      kind: 'agent_review_result';
      sessionId: string;
      result: AgentReviewResult;
    }
  | {
      kind: 'agent_diff_collected';
      sessionId: string;
      diff: AgentDiffSummary;
    }
  | {
      kind: 'agent_session_completed';
      sessionId: string;
      summary: AgentFinalSummary;
    };
