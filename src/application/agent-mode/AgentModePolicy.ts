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
  // Permission system policy
  requireApprovalBeforeFileWrite: boolean;
  requireApprovalBeforeFileDelete: boolean;
  requireApprovalBeforeDependencyInstall: boolean;
  requireApprovalBeforeGitModify: boolean;
  requireApprovalBeforeMcpToolRun: boolean;
  allowAutoApproveLowRisk: boolean;
  allowAutoApproveSession: boolean;
  neverAutoApproveHighRisk: boolean;
  blockDangerousCommands: boolean;
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
  requireApprovalBeforeFileWrite: true,
  requireApprovalBeforeFileDelete: true,
  requireApprovalBeforeDependencyInstall: true,
  requireApprovalBeforeGitModify: true,
  requireApprovalBeforeMcpToolRun: true,
  allowAutoApproveLowRisk: true,
  allowAutoApproveSession: true,
  neverAutoApproveHighRisk: true,
  blockDangerousCommands: true,
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
    requireApprovalBeforeFileWrite:        cfg.get<boolean>('agentMode.requireApprovalBeforeFileWrite',        DEFAULT_AGENT_MODE_POLICY.requireApprovalBeforeFileWrite),
    requireApprovalBeforeFileDelete:       cfg.get<boolean>('agentMode.requireApprovalBeforeFileDelete',       DEFAULT_AGENT_MODE_POLICY.requireApprovalBeforeFileDelete),
    requireApprovalBeforeDependencyInstall: cfg.get<boolean>('agentMode.requireApprovalBeforeDependencyInstall', DEFAULT_AGENT_MODE_POLICY.requireApprovalBeforeDependencyInstall),
    requireApprovalBeforeGitModify:        cfg.get<boolean>('agentMode.requireApprovalBeforeGitModify',        DEFAULT_AGENT_MODE_POLICY.requireApprovalBeforeGitModify),
    requireApprovalBeforeMcpToolRun:       cfg.get<boolean>('agentMode.requireApprovalBeforeMcpToolRun',       DEFAULT_AGENT_MODE_POLICY.requireApprovalBeforeMcpToolRun),
    allowAutoApproveLowRisk:               cfg.get<boolean>('agentMode.allowAutoApproveLowRisk',               DEFAULT_AGENT_MODE_POLICY.allowAutoApproveLowRisk),
    allowAutoApproveSession:               cfg.get<boolean>('agentMode.allowAutoApproveSession',               DEFAULT_AGENT_MODE_POLICY.allowAutoApproveSession),
    neverAutoApproveHighRisk:              cfg.get<boolean>('agentMode.neverAutoApproveHighRisk',              DEFAULT_AGENT_MODE_POLICY.neverAutoApproveHighRisk),
    blockDangerousCommands:                cfg.get<boolean>('agentMode.blockDangerousCommands',                DEFAULT_AGENT_MODE_POLICY.blockDangerousCommands),
  };
}
