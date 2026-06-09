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
};
