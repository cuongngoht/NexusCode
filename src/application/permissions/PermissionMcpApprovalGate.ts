import type { IMcpApprovalGate, McpApprovalOutcome, McpApprovalRequest } from '../../mcp/McpApprovalGate';
import type { PermissionRequest } from './PermissionTypes';
import type { PermissionService } from './PermissionService';
import { createPermissionId } from './createPermissionId';

/**
 * Bridges MCP high-risk tool approval to the existing PermissionService /
 * PermissionApprovalCard flow in the chat webview. Deny-by-default: if the
 * user does not act within the timeout, the pending request is rejected
 * (which also clears the card from the UI) and the tool never runs.
 */
export class PermissionMcpApprovalGate implements IMcpApprovalGate {
  constructor(private readonly permissionService: PermissionService) {}

  async requestApproval(request: McpApprovalRequest, timeoutMs: number): Promise<McpApprovalOutcome> {
    const permissionRequest: PermissionRequest = {
      id: createPermissionId(),
      subjectType: 'mcp',
      subjectId: request.presetId,
      subjectLabel: request.presetDisplayName,
      actionType: 'mcp.tool.run',
      risk: 'high',
      title: `Run MCP tool ${request.toolName}`,
      reason: request.reason,
      command: request.toolName,
      cwd: request.cwd,
      metadata: { arguments: request.arguments },
      createdAt: Date.now(),
    };

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // reject() resolves the pending request promise and clears the card from the UI
      this.permissionService.reject(permissionRequest.id, 'Approval timed out');
    }, timeoutMs);

    const resolution = await this.permissionService.request(permissionRequest);
    clearTimeout(timer);

    if (timedOut) return 'timeout';
    if (resolution.decision === 'approved' || resolution.decision === 'auto_approved') {
      return 'approved';
    }
    return 'denied';
  }
}
