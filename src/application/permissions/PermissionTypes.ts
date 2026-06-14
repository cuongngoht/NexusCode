export type PermissionSubjectType =
  | 'agent'
  | 'command'
  | 'skill'
  | 'mcp'
  | 'system';

export type PermissionActionType =
  | 'file.read'
  | 'file.write'
  | 'file.create'
  | 'file.delete'
  | 'file.rename'
  | 'terminal.run'
  | 'dependency.install'
  | 'git.modify'
  | 'git.push'
  | 'workspace.modify'
  | 'network.request'
  | 'mcp.tool.run';

export type PermissionRisk =
  | 'low'
  | 'medium'
  | 'high'
  | 'blocked';

export type PermissionDecision =
  | 'approved'
  | 'rejected'
  | 'auto_approved'
  | 'blocked'
  | 'expired';

export interface PermissionRequest {
  id: string;
  sessionId?: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  subjectLabel: string;
  actionType: PermissionActionType;
  risk: PermissionRisk;
  title: string;
  reason: string;
  target?: string;
  command?: string;
  cwd?: string;
  diffPreview?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface PermissionResolution {
  requestId: string;
  decision: PermissionDecision;
  reason?: string;
  resolvedAt: number;
}

export interface AutoApproveRule {
  scope: 'session' | 'workspace';
  sessionId?: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  actionType: PermissionActionType;
  maxRisk: 'low' | 'medium';
  createdAt: number;
}
