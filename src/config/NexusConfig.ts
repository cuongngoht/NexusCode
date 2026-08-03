export interface ProviderConfig {
  enabled: boolean
  command: string
}

export interface McpPresetConfig {
  enabled: boolean
}

export interface Context7McpPresetConfig extends McpPresetConfig {
  apiKey?: string
}

/**
 * User-defined MCP server, declared in `.nexus/config.json` using the same
 * shape as Claude Code's `.mcp.json` entries:
 *
 * "nexus-docs": {
 *   "type": "http",
 *   "url": "https://example.com/mcp",
 *   "headers": { "Authorization": "Bearer ..." }
 * }
 */
export interface McpCustomServerConfig {
  /** 'http' → Streamable HTTP transport, 'stdio' → local process. */
  type: 'http' | 'stdio'
  /** Required when type === 'http'. */
  url?: string
  /** Extra HTTP headers (e.g. Authorization) sent on every request. */
  headers?: Record<string, string>
  /** Required when type === 'stdio'. */
  command?: string
  args?: string[]
  env?: Record<string, string>
  /** Defaults to true. */
  enabled?: boolean
  /** Skip tools/list discovery and always call this tool. */
  defaultTool?: string
  /** Keywords that boost auto-selection. Defaults to tokens of the server name. */
  bestFor?: string[]
  /** Defaults to 'high' → goes through the approval gate. */
  risk?: 'low' | 'medium' | 'high'
}

export interface McpConfig {
  enabled: boolean
  autoSelectPreset: boolean
  requireApprovalForHighRiskTools: boolean
  approvalTimeoutMs: number
  maxResultChars: number
  maxRoundsPerTask: number
  presets: {
    microsoftLearn: McpPresetConfig
    context7: Context7McpPresetConfig
  }
  /** User-defined MCP servers, keyed by name. Optional for backward compatibility. */
  customServers?: Record<string, McpCustomServerConfig>
}

export interface CompactConfig {
  enabled: boolean
  suggestAfterMessages: number
  recentMessagesAfterCompact: number
  maxCompactSummaryChars: number
}

export type RoutingStrategy = 'fastest' | 'cheapest' | 'quality' | 'balanced' | 'manual';

export interface FallbackRoutingConfig {
  enabled: boolean;
  maxAttempts: number;
  retrySameProvider: boolean;
  fallbackOn: string[];
  doNotFallbackOn: string[];
}

export interface RoutingConfig {
  defaultProvider: string;
  strategy: RoutingStrategy;
  fallback: FallbackRoutingConfig;
  modePreferences: Record<string, string[]>;
  chains?: Record<string, string>;
}

export interface ModelCatalogConfig {
  cacheTtlMs: number;
  preferDynamicModels: boolean;
  allowSeededFallback: boolean;
}

export interface HistoryRagConfig {
  enabled: boolean
  maxResults: number
  maxChars: number
  minScore: number
}

export type SubagentMode = 'off' | 'auto' | 'manual' | 'full';
export type SubagentPreset = 'fast' | 'balanced' | 'architecture' | 'full' | 'safe';
export type SubagentRoleId =
  | 'search' | 'planner' | 'coder' | 'debugger' | 'tester'
  | 'reviewer' | 'security' | 'docs' | 'product' | 'research' | 'architect';

export interface SubagentModeOverrideConfig {
  enabled?: boolean;
  preset?: SubagentPreset;
  maxRuns?: number;
  maxParallel?: number;
  includeSecurity?: boolean;
  includeDocs?: boolean;
  includeReviewer?: boolean;
  includeTester?: boolean;
}

export interface SubagentConfig {
  enabled: boolean;
  mode: SubagentMode;
  preset: SubagentPreset;
  maxRuns: number;
  maxParallel: number;
  hardCap: number;
  includeSecurity: boolean;
  includeDocs: boolean;
  includeReviewer: boolean;
  includeTester: boolean;
  failOpen: boolean;
  injectMaxChars: number;
  timeoutMs: number;
  selectedRoles: SubagentRoleId[];
  modeOverrides?: Record<string, SubagentModeOverrideConfig>;
}

export interface ReviewStepSettings {
  reviewer: boolean;
  tester: boolean;
  security: boolean;
  architect: boolean;
}

export interface NexusConfig {
  version: 1
  providers: {
    antigravity: ProviderConfig
    codex: ProviderConfig
    claude: ProviderConfig
    copilot: ProviderConfig
    aider: ProviderConfig
    grok: ProviderConfig
  }
  mcp: McpConfig
  compact: CompactConfig
  /** Routing configuration — all fields optional for backward compatibility. */
  routing?: Partial<RoutingConfig>
  /** Model catalog configuration — all fields optional for backward compatibility. */
  modelCatalog?: Partial<ModelCatalogConfig>
  /** History RAG — optional for backward compatibility. */
  historyRag?: Partial<HistoryRagConfig>
  /** Subagents configuration — optional for backward compatibility. */
  subagents?: Partial<SubagentConfig>
}
