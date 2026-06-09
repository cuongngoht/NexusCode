import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, spawnSync } from 'child_process';
import type { ProviderId, ProviderModel } from './types';

// ── Result type ────────────────────────────────────────────────────────────

export interface ProviderDetectionResult {
  id: ProviderId;
  displayName: string;
  cliLabel: string;
  installed: boolean;
  loggedIn?: boolean;
  loginCommand?: string;
  version?: string;
  executablePath?: string;
  reason?: string;
  supportsModelSelection: boolean;
  defaultModel?: string;
  models: ProviderModel[];
}

// ── Per-provider specs ─────────────────────────────────────────────────────

interface ProviderLoginCheck {
  /** At least one env var must be non-empty to consider the provider logged in. */
  envVars?: string[];
  /** At least one path (relative to os.homedir()) must exist. */
  configPaths?: string[];
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
      configPaths: ['.claude/auth.json', '.claude/.credentials.json', '.config/claude/auth.json'],
    },
    loginCommand: 'claude',
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
    loginCheck: { envVars: ['OPENAI_API_KEY'] },
  },
  {
    id: 'gemini',
    displayName: 'Gemini',
    cliLabel: 'Gemini CLI',
    binary: 'gemini',
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
    seededModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-pro',
    loginCheck: {
      envVars: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
      configPaths: ['.gemini/credentials.json', '.config/gemini/credentials.json'],
    },
    loginCommand: 'gemini',
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
    loginCheck: { envVars: ['GITHUB_TOKEN', 'GH_TOKEN'] },
    loginCommand: 'gh auth login',
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
  },
];

// ── Internal helpers ───────────────────────────────────────────────────────

/** Checks whether a provider's auth/login requirements are satisfied. */
function checkLogin(spec: ProviderSpec): boolean {
  if (!spec.loginCheck) return true;
  const { envVars, configPaths } = spec.loginCheck;
  if (envVars?.some(v => !!process.env[v])) return true;
  if (configPaths?.some(p => fs.existsSync(path.join(os.homedir(), p)))) return true;
  return false;
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

function seededModels(spec: ProviderSpec): ProviderModel[] {
  return spec.seededModels.map(model => ({
    id: model,
    label: model,
    source: 'seeded',
  }));
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

    if (!executablePath) {
      return {
        id: spec.id,
        displayName: spec.displayName,
        cliLabel: spec.cliLabel,
        installed: false,
        reason: `'${spec.binary}' not found in PATH`,
        supportsModelSelection: spec.seededModels.length > 0,
        defaultModel: spec.defaultModel,
        models: seededModels(spec),
      };
    }

    const version = await runForVersion(spec.binary, spec.versionArgs, spec.versionPattern);

    return {
      id: spec.id,
      displayName: spec.displayName,
      cliLabel: spec.cliLabel,
      installed: true,
      loggedIn: checkLogin(spec),
      loginCommand: spec.loginCommand,
      version,
      executablePath,
      supportsModelSelection: spec.seededModels.length > 0,
      defaultModel: spec.defaultModel,
      models: seededModels(spec),
    };
  }
}
