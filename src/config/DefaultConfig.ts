import type { NexusConfig } from './NexusConfig';

export const DEFAULT_CONFIG: NexusConfig = {
  version: 1,
  providers: {
    antigravity: { enabled: true, command: 'agy' },
    codex: { enabled: true, command: 'codex' },
    claude: { enabled: false, command: 'claude' },
    copilot: { enabled: false, command: 'copilot' },
    aider: { enabled: false, command: 'aider' },
    grok: { enabled: false, command: 'grok' },
  },
  mcp: {
    enabled: false,
    autoSelectPreset: true,
    requireApprovalForHighRiskTools: true,
    maxResultChars: 6000,
    maxRoundsPerTask: 1,
    presets: {
      microsoftLearn: { enabled: true },
      context7: { enabled: true, apiKey: '' },
    },
  },
  compact: {
    enabled: true,
    suggestAfterMessages: 12,
    recentMessagesAfterCompact: 6,
    maxCompactSummaryChars: 8_000,
  },
  routing: {
    defaultProvider: 'claude',
    strategy: 'balanced',
    fallback: {
      enabled: true,
      maxAttempts: 2,
      retrySameProvider: false,
      fallbackOn: [
        'missing_cli',
        'auth_error',
        'rate_limit',
        'timeout',
        'non_zero_exit',
        'empty_output',
      ],
      doNotFallbackOn: ['user_cancelled', 'permission_denied'],
    },
    modePreferences: {},
  },
  modelCatalog: {
    cacheTtlMs: 300_000,
    preferDynamicModels: false,
    allowSeededFallback: true,
  },
};
