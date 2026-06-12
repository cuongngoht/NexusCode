import type { ProviderId } from '../core/types';
import type { ProviderSpec } from './ProviderTypes';

export const PROVIDER_SPECS: readonly ProviderSpec[] = [
  {
    id: 'claude',
    displayName: 'Claude',
    cliLabel: 'Claude CLI',
    binary: 'claude',
    versionArgs: ['--version'],
    // "Claude Code 1.2.3" or just "1.2.3"
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
    seededModels: ['sonnet', 'opus', 'haiku'],
    defaultModel: 'sonnet',
    loginCheck: {
      statusCommand: {
        binary: 'claude',
        args: ['auth', 'status'],
        timeoutMs: 6_000,
        authenticatedPattern: /"loggedIn":\s*true/,
        unauthenticatedPattern: /"loggedIn":\s*false/,
      },
      envVars: ['ANTHROPIC_API_KEY'],
      configPaths: ['.claude/auth.json', '.claude/.credentials.json', '.config/claude/auth.json'],
    },
    loginCommand: 'claude',
    installCommands: {
      darwin: 'curl -fsSL https://claude.ai/install.sh | bash',
      linux: 'curl -fsSL https://claude.ai/install.sh | bash',
      win32: 'irm https://claude.ai/install.ps1 | iex',
    },
    installDocsUrl: 'https://code.claude.com/docs/en/quickstart',
  },
  {
    id: 'codex',
    displayName: 'Codex',
    cliLabel: 'Codex CLI',
    binary: 'codex',
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
    seededModels: ['gpt-5.2', 'gpt-5.1-codex-max', 'gpt-5.1-codex', 'gpt-5-codex', 'o3'],
    defaultModel: 'gpt-5.2',
    loginCheck: {
      envVars: ['OPENAI_API_KEY'],
      configPaths: ['.codex/auth.json'],
    },
    loginCommand: 'codex',
    installCommands: {
      darwin: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
      linux: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
      win32: 'powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"',
    },
    installDocsUrl: 'https://developers.openai.com/codex/cli',
  },
  {
    id: 'antigravity',
    displayName: 'Antigravity',
    cliLabel: 'Antigravity CLI',
    binary: 'agy',
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
    seededModels: ['gemini-3.5-pro', 'gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    defaultModel: 'gemini-3.5-pro',
    loginCommand: 'agy',
    installCommands: {
      darwin: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      linux: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      win32: 'irm https://antigravity.google/cli/install.ps1 | iex',
    },
    installDocsUrl: 'https://github.com/google-antigravity/antigravity-cli',
  },
  {
    id: 'copilot',
    displayName: 'Copilot',
    cliLabel: 'Copilot CLI',
    binary: 'copilot',
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
    seededModels: ['gpt-5.2', 'gpt-5.1', 'claude-sonnet-4.5'],
    defaultModel: 'gpt-5.2',
    loginCheck: {
      statusCommand: { binary: 'gh', args: ['auth', 'status'], timeoutMs: 6_000 },
      envVars: ['GITHUB_TOKEN', 'GH_TOKEN'],
    },
    loginCommand: 'gh auth login',
    installCommands: {
      darwin: 'npm install -g @github/copilot',
      linux: 'npm install -g @github/copilot',
      win32: 'npm install -g @github/copilot',
    },
    installDocsUrl: 'https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli',
  },
  {
    id: 'aider',
    displayName: 'Aider',
    cliLabel: 'Aider CLI',
    binary: 'aider',
    versionArgs: ['--version'],
    // "aider 0.50.1"
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
    seededModels: ['sonnet', 'opus', 'gpt-5.2', 'gemini/gemini-2.5-pro'],
    defaultModel: 'sonnet',
    loginCheck: { envVars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY'] },
    installCommands: {
      darwin: 'curl -LsSf https://aider.chat/install.sh | sh',
      linux: 'curl -LsSf https://aider.chat/install.sh | sh',
      win32: 'powershell -ExecutionPolicy ByPass -c "irm https://aider.chat/install.ps1 | iex"',
    },
    installDocsUrl: 'https://aider.chat/docs/install.html',
  },
  {
    id: 'grok',
    displayName: 'Grok',
    cliLabel: 'Grok CLI',
    binary: 'grok',
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
    seededModels: ['grok-3', 'grok-3-mini', 'grok-2', 'grok-2-mini'],
    defaultModel: 'grok-3',
    loginCommand: 'grok auth',
    installCommands: {
      darwin: 'curl -fsSL https://x.ai/cli/install.sh | bash',
      linux: 'curl -fsSL https://x.ai/cli/install.sh | bash',
    },
    installDocsUrl: 'https://x.ai/cli',
  },
];

export function getProviderSpec(id: ProviderId): ProviderSpec | undefined {
  return PROVIDER_SPECS.find(s => s.id === id);
}

export function getAllProviderSpecs(): readonly ProviderSpec[] {
  return PROVIDER_SPECS;
}
