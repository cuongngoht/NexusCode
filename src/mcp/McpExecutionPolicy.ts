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

    // Medium always prompts. The settings UI labels this level "Medium — approve every
    // call", and it previously did not: medium fell through to the low-risk branch and
    // ran unapproved. Deliberately NOT gated on requireApprovalForHighRiskTools — that
    // flag is named for high risk, so a user who disables it is opting out of
    // high-risk prompts, not of every prompt.
    if (input.preset.risk === 'medium') {
      return {
        allowed: true,
        requiresApproval: true,
        reason: 'Medium-risk MCP tool requires approval.',
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
      reason: 'Allowed low-risk MCP documentation tool.',
    };
  }
}
