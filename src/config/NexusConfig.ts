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

export interface McpConfig {
  enabled: boolean
  autoSelectPreset: boolean
  requireApprovalForHighRiskTools: boolean
  maxResultChars: number
  maxRoundsPerTask: number
  presets: {
    microsoftLearn: McpPresetConfig
    context7: Context7McpPresetConfig
  }
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
}
