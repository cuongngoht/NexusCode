import type { TaskMode } from '../core/types';
import type { McpToolGroup } from '../core/mcp/McpIntentProtocol';

export type McpBuiltinPresetId = 'microsoftLearn' | 'context7';

/** Custom servers are registered as `custom:<name>` from `.nexus/config.json`. */
export type McpPresetId = McpBuiltinPresetId | `custom:${string}`;

export type McpTransport = 'stdio' | 'streamableHttp';

export type McpRiskLevel = 'low' | 'medium' | 'high';

export interface McpPreset {
  id: McpPresetId;
  displayName: string;
  description: string;
  transport: McpTransport;
  priority: number;
  enabledByDefault: boolean;
  bestFor: string[];
  toolGroups: McpToolGroup[];
  risk: McpRiskLevel;
  endpoint?: string;
  /** Extra HTTP headers (e.g. Authorization) for streamableHttp transports. */
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** When set, skip tools/list discovery and always call this tool. */
  defaultTool?: string;
}

/** A tool advertised by an MCP server via tools/list. */
export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolIntent {
  group: McpToolGroup;
  query: string;
  reason: string;
}

export interface McpRoute {
  presetId: McpPresetId;
  toolName: string;
  arguments: Record<string, unknown>;
  reason: string;
}

export interface McpExecutionDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
}

/** Outcome of one MCP round. `contextText` is always safe to inject into the next prompt. */
export interface McpRoundOutcome {
  status: 'executed' | 'rejected' | 'denied' | 'error';
  contextText: string;
  /**
   * The preset and tool this round concerned — populated for *every* status once a
   * preset has been selected, not just on success, so a blocked round can name the
   * server it was blocked on. Absent only when no preset matched at all.
   */
  used?: { presetId: McpPresetId; presetDisplayName: string; toolName: string };
}

export interface McpToolResult {
  presetId: McpPresetId;
  toolName: string;
  rawText: string;
  compactText: string;
  truncated: boolean;
}

export interface McpPresetStatusView {
  id: McpPresetId;
  displayName: string;
  enabled: boolean;
  transport: McpTransport;
  risk: McpRiskLevel;
}

// Re-export TaskMode and McpToolGroup so callers don't need separate imports.
// McpToolGroup is owned by core/mcp/McpIntentProtocol (single source of truth with
// MCP_TOOL_GROUPS, which the parser validates against and the instructions render from).
export type { TaskMode, McpToolGroup };
