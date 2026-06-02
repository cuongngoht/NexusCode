import { spawn, spawnSync } from 'child_process';
import type { ProviderId } from './types';

// ── Result type ────────────────────────────────────────────────────────────

export interface ProviderDetectionResult {
  id: ProviderId;
  installed: boolean;
  version?: string;
  executablePath?: string;
  reason?: string;
}

// ── Per-provider specs ─────────────────────────────────────────────────────

interface ProviderSpec {
  id: ProviderId;
  /** Binary name to search in PATH */
  binary: string;
  /** Args to pass for version output */
  versionArgs: string[];
  /** Extracts a semver-like string from combined stdout+stderr */
  versionPattern: RegExp;
}

const SPECS: readonly ProviderSpec[] = [
  {
    id: 'claude',
    binary: 'claude',
    versionArgs: ['--version'],
    // "Claude Code 1.2.3" or just "1.2.3"
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
  },
  {
    id: 'codex',
    binary: 'codex',
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
  },
  {
    id: 'gemini',
    binary: 'gemini',
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
  },
  {
    id: 'copilot',
    binary: 'copilot',
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
  },
  {
    id: 'aider',
    binary: 'aider',
    versionArgs: ['--version'],
    // "aider 0.50.1"
    versionPattern: /(\d+\.\d+(?:\.\d+)*)/,
  },
];

// ── Internal helpers ───────────────────────────────────────────────────────

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
        installed: false,
        reason: `'${spec.binary}' not found in PATH`,
      };
    }

    const version = await runForVersion(spec.binary, spec.versionArgs, spec.versionPattern);

    return {
      id: spec.id,
      installed: true,
      version,
      executablePath,
    };
  }
}
