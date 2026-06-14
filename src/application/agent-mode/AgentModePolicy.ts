import * as vscode from 'vscode';

export interface AgentModePolicy {
  enabled: boolean;
  requirePlanApproval: boolean;
  createCheckpointBeforeEdit: boolean;
  requireApprovalBeforeTerminal: boolean;
  autoRunTests: boolean;
  autoFixTestFailures: boolean;
  maxRecoveryAttempts: number;
  collectFinalDiff: boolean;
  updateDocsWhenNeeded: boolean;
  useWorkingBranch: boolean;
  branchPrefix: string;
  maxDiffChars: number;
}

export const DEFAULT_AGENT_MODE_POLICY: AgentModePolicy = {
  enabled: true,
  requirePlanApproval: true,
  createCheckpointBeforeEdit: true,
  requireApprovalBeforeTerminal: true,
  autoRunTests: true,
  autoFixTestFailures: true,
  maxRecoveryAttempts: 2,
  collectFinalDiff: true,
  updateDocsWhenNeeded: false,
  useWorkingBranch: false,
  branchPrefix: 'nexus/agent-',
  maxDiffChars: 30000,
};

export function loadAgentModePolicy(config?: vscode.WorkspaceConfiguration): AgentModePolicy {
  const cfg = config ?? vscode.workspace.getConfiguration('nexus');
  return {
    enabled:                     cfg.get<boolean>('agentMode.enabled',                     DEFAULT_AGENT_MODE_POLICY.enabled),
    requirePlanApproval:         cfg.get<boolean>('agentMode.requirePlanApproval',         DEFAULT_AGENT_MODE_POLICY.requirePlanApproval),
    createCheckpointBeforeEdit:  cfg.get<boolean>('agentMode.createCheckpointBeforeEdit',  DEFAULT_AGENT_MODE_POLICY.createCheckpointBeforeEdit),
    requireApprovalBeforeTerminal: cfg.get<boolean>('agentMode.requireApprovalBeforeTerminal', DEFAULT_AGENT_MODE_POLICY.requireApprovalBeforeTerminal),
    autoRunTests:                cfg.get<boolean>('agentMode.autoRunTests',                DEFAULT_AGENT_MODE_POLICY.autoRunTests),
    autoFixTestFailures:         cfg.get<boolean>('agentMode.autoFixTestFailures',         DEFAULT_AGENT_MODE_POLICY.autoFixTestFailures),
    maxRecoveryAttempts:         cfg.get<number>('agentMode.maxRecoveryAttempts',          DEFAULT_AGENT_MODE_POLICY.maxRecoveryAttempts),
    collectFinalDiff:            cfg.get<boolean>('agentMode.collectFinalDiff',            DEFAULT_AGENT_MODE_POLICY.collectFinalDiff),
    updateDocsWhenNeeded:        cfg.get<boolean>('agentMode.updateDocsWhenNeeded',        DEFAULT_AGENT_MODE_POLICY.updateDocsWhenNeeded),
    useWorkingBranch:            cfg.get<boolean>('agentMode.useWorkingBranch',            DEFAULT_AGENT_MODE_POLICY.useWorkingBranch),
    branchPrefix:                cfg.get<string>('agentMode.branchPrefix',                 DEFAULT_AGENT_MODE_POLICY.branchPrefix),
    maxDiffChars:                cfg.get<number>('agentMode.maxDiffChars',                 DEFAULT_AGENT_MODE_POLICY.maxDiffChars),
  };
}
