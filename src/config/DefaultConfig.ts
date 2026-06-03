import type { NexusConfig } from './NexusConfig';

export const DEFAULT_CONFIG: NexusConfig = {
  version: 1,
  providers: {
    gemini: { enabled: true, command: 'gemini' },
    codex: { enabled: true, command: 'codex' },
    claude: { enabled: false, command: 'claude' },
    copilot: { enabled: false, command: 'copilot' },
    aider: { enabled: false, command: 'aider' },
  },
};
