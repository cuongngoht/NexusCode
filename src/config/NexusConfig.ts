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

export interface NexusConfig {
  version: 1
  providers: {
    gemini: ProviderConfig
    codex: ProviderConfig
    claude: ProviderConfig
    copilot: ProviderConfig
    aider: ProviderConfig
  }
  mcp: McpConfig
}
