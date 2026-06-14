import type { ProviderId } from '../core/types';
import type { ProviderModel } from '../core/types';

export type ProviderAuthStatus = 'authenticated' | 'unauthenticated' | 'unknown';

export type PackageManager =
  | 'brew' | 'apt' | 'dnf' | 'yum' | 'pacman'
  | 'npm' | 'pnpm' | 'bun'
  | 'winget' | 'choco' | 'scoop' | 'manual';

export type InstallRisk = 'low' | 'medium' | 'high';

export interface ProviderInstallOption {
  manager: PackageManager;
  command: string;
  risk: InstallRisk;
  requiresConfirmation: boolean;
}

export interface ProviderInstallCommands {
  darwin?: string;
  linux?: string;
  win32?: string;
}

export interface ProviderLoginCheck {
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

export interface ProviderModelListCommand {
  binary: string;
  args: string[];
  timeoutMs?: number;
  parser: 'json' | 'lines' | 'regex';
  jsonPath?: string;
  regex?: RegExp;
}

export interface ProviderSpec {
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
  /** Optional command to list available models dynamically. */
  modelListCommand?: ProviderModelListCommand;
}

// ── Detection result (moved from core/ for proper layering) ─────────────────

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
