import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, spawnSync } from 'child_process';
import type { ProviderId, ProviderModel } from './types';

// ── Result type ────────────────────────────────────────────────────────────

export type ProviderAuthStatus = 'authenticated' | 'unauthenticated' | 'unknown';

export interface ProviderDetectionResult {
  id: ProviderId;
  displayName: string;
  cliLabel: string;
  installed: boolean;
  authStatus: ProviderAuthStatus;
  loggedIn?: boolean;
  loginCommand?: string;
  installCommand?: string;
  installDocsUrl?: string;
  version?: string;
  executablePath?: string;
  reason?: string;
  supportsModelSelection: boolean;
  defaultModel?: string;
  models: ProviderModel[];
}

// ── Per-provider specs ─────────────────────────────────────────────────────

interface ProviderLoginCheck {
  /** Optional non-mutating command that reports whether auth is valid. */
  statusCommand?: {
    binary: string;
    args: string[];
    timeoutMs?: number;
    authenticatedPattern?: RegExp;
    unauthenticatedPattern?: RegExp;
  };
  /** At least one env var must be non-empty to consider the provider logged in. */
  envVars?: string[];
  /** At least one path (relative to os.homedir()) must exist. */
  configPaths?: string[];
}

interface ProviderInstallCommands {
  darwin?: string;
  linux?: string;
  win32?: string;
}

interface ProviderSpec {
  id: ProviderId;
  displayName: string;
  cliLabel: string;
  /** Binary name to search in PATH */
  binary: string;
  /** Args to pass for version output */
  versionArgs: string[];
  /** Extracts a semver-like string from combined stdout+stderr */
  versionPattern: RegExp;
  /** Seeded fallback models used when the CLI cannot list models. */
  seededModels: readonly string[];
  defaultModel?: string;
  /** Optional auth/login check performed after binary detection. */
  loginCheck?: ProviderLoginCheck;
  /** Terminal command to run when the user wants to log in. */
  loginCommand?: string;
  /** Terminal command to paste when the CLI is missing. */
  installCommands?: ProviderInstallCommands;
  /** Official installation documentation URL. */
  installDocsUrl?: string;
}

const SPECS: readonly ProviderSpec[] = [
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

// ── Internal helpers ───────────────────────────────────────────────────────

/** Checks whether a provider's auth/login requirements are satisfied. */
async function checkAuthStatus(spec: ProviderSpec): Promise<ProviderAuthStatus> {
  if (!spec.loginCheck) return 'unknown';
  const { envVars, configPaths } = spec.loginCheck;
  const hasEnvOrConfig =
    !!envVars?.some(v => !!process.env[v]) ||
    !!configPaths?.some(p => fs.existsSync(path.join(os.homedir(), p)));

  if (hasEnvOrConfig) return 'authenticated';

  if (spec.loginCheck.statusCommand) {
    const result = await runStatusCommand(spec.loginCheck.statusCommand);
    if (result === 'authenticated' || result === 'unauthenticated') {
      return result;
    }
  }

  if ((envVars?.length ?? 0) > 0 || (configPaths?.length ?? 0) > 0) {
    return 'unauthenticated';
  }

  return 'unknown';
}

/** Returns the full path to `binary` from PATH, or undefined if not found. */
function resolveBinary(binary: string): string | undefined {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(cmd, [binary], { timeout: 3_000, encoding: 'utf8' });
  if (result.status === 0 && result.stdout) {
    return result.stdout.trim().split('\n')[0].trim();
  }
  return undefined;
}

/** Runs `binary versionArgs` and returns parsed version string, or undefined. */
function runForVersion(binary: string, args: string[], pattern: RegExp): Promise<string | undefined> {
  return new Promise(resolve => {
    let out = '';
    const proc = spawn(binary, args, { timeout: 6_000 });
    proc.stdout.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    proc.on('close', () => {
      const match = out.match(pattern);
      resolve(match?.[1]);
    });
    proc.on('error', () => resolve(undefined));
  });
}

function runStatusCommand(command: NonNullable<ProviderLoginCheck['statusCommand']>): Promise<ProviderAuthStatus> {
  return new Promise(resolve => {
    let settled = false;
    let out = '';
    const finish = (status: ProviderAuthStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(status);
    };

    const proc = spawn(command.binary, command.args, { shell: false });
    const timer = setTimeout(() => {
      proc.kill();
      finish('unknown');
    }, command.timeoutMs ?? 6_000);

    proc.stdout.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    proc.on('error', () => finish('unknown'));
    proc.on('close', code => {
      if (command.unauthenticatedPattern?.test(out)) {
        finish('unauthenticated');
        return;
      }
      if (command.authenticatedPattern?.test(out)) {
        finish('authenticated');
        return;
      }
      finish(code === 0 ? 'authenticated' : 'unauthenticated');
    });
  });
}

function seededModels(spec: ProviderSpec): ProviderModel[] {
  return spec.seededModels.map(model => ({
    id: model,
    label: model,
    source: 'seeded',
  }));
}

function getInstallCommand(spec: ProviderSpec): string | undefined {
  const commands = spec.installCommands;
  if (!commands) return undefined;
  if (process.platform === 'darwin') return commands.darwin ?? commands.linux ?? commands.win32;
  if (process.platform === 'linux') return commands.linux ?? commands.darwin ?? commands.win32;
  if (process.platform === 'win32') return commands.win32 ?? commands.darwin ?? commands.linux;
  return commands.linux ?? commands.darwin ?? commands.win32;
}

function loggedInFromAuthStatus(authStatus: ProviderAuthStatus): boolean | undefined {
  if (authStatus === 'authenticated') return true;
  if (authStatus === 'unauthenticated') return false;
  return undefined;
}

// ── Detector ───────────────────────────────────────────────────────────────

export class ProviderDetector {
  private readonly cache = new Map<ProviderId, ProviderDetectionResult>();
  private cacheStampMs = 0;
  private static readonly CACHE_TTL_MS = 30_000;

  /**
   * Detects all known CLI providers.
   * Results are cached for 30 s to avoid repeated slow lookups.
   */
  async detectAll(): Promise<ProviderDetectionResult[]> {
    if (this.isCacheValid()) {
      return Array.from(this.cache.values());
    }
    const results = await Promise.all(SPECS.map(s => this.detectSpec(s)));
    this.cache.clear();
    for (const r of results) {
      this.cache.set(r.id, r);
    }
    this.cacheStampMs = Date.now();
    return results;
  }

  /**
   * Detects a single provider.
   * Skips cache — always does a fresh check (used before running a task).
   */
  async detectOne(id: ProviderId): Promise<ProviderDetectionResult | undefined> {
    const spec = SPECS.find(s => s.id === id);
    if (!spec) {
      return undefined;
    }
    const result = await this.detectSpec(spec);
    this.cache.set(id, result);
    return result;
  }

  getInstallCommand(id: ProviderId): string | undefined {
    const spec = SPECS.find(s => s.id === id);
    return spec ? getInstallCommand(spec) : undefined;
  }

  getLoginCommand(id: ProviderId): string | undefined {
    return SPECS.find(s => s.id === id)?.loginCommand;
  }

  /** Clears the cache, forcing a fresh detectAll() next call. */
  invalidate(): void {
    this.cache.clear();
    this.cacheStampMs = 0;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private isCacheValid(): boolean {
    return this.cache.size > 0 && Date.now() - this.cacheStampMs < ProviderDetector.CACHE_TTL_MS;
  }

  private async detectSpec(spec: ProviderSpec): Promise<ProviderDetectionResult> {
    const executablePath = resolveBinary(spec.binary);
    const installCommand = getInstallCommand(spec);

    if (!executablePath) {
      return {
        id: spec.id,
        displayName: spec.displayName,
        cliLabel: spec.cliLabel,
        installed: false,
        authStatus: 'unknown',
        loggedIn: undefined,
        loginCommand: spec.loginCommand,
        installCommand,
        installDocsUrl: spec.installDocsUrl,
        reason: `'${spec.binary}' not found in PATH`,
        supportsModelSelection: spec.seededModels.length > 0,
        defaultModel: spec.defaultModel,
        models: seededModels(spec),
      };
    }

    const version = await runForVersion(spec.binary, spec.versionArgs, spec.versionPattern);
    const authStatus = await checkAuthStatus(spec);

    return {
      id: spec.id,
      displayName: spec.displayName,
      cliLabel: spec.cliLabel,
      installed: true,
      authStatus,
      loggedIn: loggedInFromAuthStatus(authStatus),
      loginCommand: spec.loginCommand,
      installCommand,
      installDocsUrl: spec.installDocsUrl,
      version,
      executablePath,
      supportsModelSelection: spec.seededModels.length > 0,
      defaultModel: spec.defaultModel,
      models: seededModels(spec),
    };
  }
}
