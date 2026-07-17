export interface McpApprovalRequest {
  presetId: string;
  presetDisplayName: string;
  toolName: string;
  arguments: Record<string, unknown>;
  reason: string;
  cwd?: string;
}

export type McpApprovalOutcome = 'approved' | 'denied' | 'timeout';

/**
 * Port for asking the user to approve a high-risk MCP tool call.
 * Kept free of vscode/webview types so the MCP layer stays UI-agnostic;
 * the concrete adapter lives in the application layer.
 */
export interface IMcpApprovalGate {
  requestApproval(request: McpApprovalRequest, timeoutMs: number): Promise<McpApprovalOutcome>;
}
