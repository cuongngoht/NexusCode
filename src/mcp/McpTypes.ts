import type { TaskMode } from '../core/types';

export type McpBuiltinPresetId = 'microsoftLearn' | 'context7';

/** Custom servers are registered as `custom:<name>` from `.nexus/config.json`. */
export type McpPresetId = McpBuiltinPresetId | `custom:${string}`;

export type McpTransport = 'stdio' | 'streamableHttp';

export type McpToolGroup =
  | 'docs'
  | 'samples'
  | 'library-api'
  | 'microsoft-docs';

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

// Re-export TaskMode so callers don't need a separate import
export type { TaskMode };
