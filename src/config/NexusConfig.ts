export interface ProviderConfig {
  enabled: boolean
  command: string
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
}
