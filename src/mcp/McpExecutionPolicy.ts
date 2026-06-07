import type { TaskMode } from '../core/types';
import type { McpExecutionDecision, McpPreset, McpRoute } from './McpTypes';

export interface IMcpExecutionPolicy {
  evaluate(input: {
    mode: TaskMode;
    preset: McpPreset;
    route: McpRoute;
    mcpEnabled: boolean;
    requireApprovalForHighRiskTools: boolean;
  }): McpExecutionDecision;
}

export class McpExecutionPolicy implements IMcpExecutionPolicy {
  evaluate(input: {
    mode: TaskMode;
    preset: McpPreset;
    route: McpRoute;
    mcpEnabled: boolean;
    requireApprovalForHighRiskTools: boolean;
  }): McpExecutionDecision {
    if (!input.mcpEnabled) {
      return { allowed: false, requiresApproval: false, reason: 'MCP is disabled.' };
    }

    if (!input.route.toolName) {
      return { allowed: false, requiresApproval: false, reason: 'Missing MCP tool name.' };
    }

    if (!input.route.arguments || typeof input.route.arguments !== 'object') {
      return { allowed: false, requiresApproval: false, reason: 'Invalid MCP tool arguments.' };
    }

    if (input.preset.risk === 'high') {
      return {
        allowed: true,
        requiresApproval: input.requireApprovalForHighRiskTools,
        reason: 'High-risk MCP tool requires approval.',
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
      reason: 'Allowed low-risk MCP documentation tool.',
    };
  }
}
