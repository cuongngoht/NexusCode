import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, spawnSync } from 'child_process';
import type { ProviderId, ProviderModel } from '../core/types';
import type {
  ProviderSpec,
  ProviderLoginCheck,
  ProviderDetectionResult,
  ProviderAuthStatus,
} from './ProviderTypes';
import { PROVIDER_SPECS } from './ProviderSpecRegistry';

// Re-export for backward compatibility convenience
export type { ProviderAuthStatus, ProviderDetectionResult } from './ProviderTypes';

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
    const results = await Promise.all(PROVIDER_SPECS.map(s => this.detectSpec(s)));
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
    const spec = PROVIDER_SPECS.find(s => s.id === id);
    if (!spec) {
      return undefined;
    }
    const result = await this.detectSpec(spec);
    this.cache.set(id, result);
    return result;
  }

  getInstallCommand(id: ProviderId): string | undefined {
    const spec = PROVIDER_SPECS.find(s => s.id === id);
    return spec ? getInstallCommand(spec) : undefined;
  }

  getLoginCommand(id: ProviderId): string | undefined {
    return PROVIDER_SPECS.find(s => s.id === id)?.loginCommand;
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
