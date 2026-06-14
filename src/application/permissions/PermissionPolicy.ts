export interface PermissionPolicyConfig {
  requireApprovalBeforeFileWrite: boolean;
  requireApprovalBeforeFileDelete: boolean;
  requireApprovalBeforeTerminalRun: boolean;
  requireApprovalBeforeDependencyInstall: boolean;
  requireApprovalBeforeGitModify: boolean;
  requireApprovalBeforeMcpToolRun: boolean;
  allowAutoApproveLowRisk: boolean;
  allowAutoApproveSession: boolean;
  neverAutoApproveHighRisk: boolean;
  blockDangerousCommands: boolean;
}

export const DEFAULT_PERMISSION_POLICY: PermissionPolicyConfig = {
  requireApprovalBeforeFileWrite: true,
  requireApprovalBeforeFileDelete: true,
  requireApprovalBeforeTerminalRun: true,
  requireApprovalBeforeDependencyInstall: true,
  requireApprovalBeforeGitModify: true,
  requireApprovalBeforeMcpToolRun: true,
  allowAutoApproveLowRisk: true,
  allowAutoApproveSession: true,
  neverAutoApproveHighRisk: true,
  blockDangerousCommands: true,
};
