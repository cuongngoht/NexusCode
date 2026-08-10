import type { NexusConfig } from './NexusConfig';
import { DEFAULT_CONFIG } from './DefaultConfig';

/**
 * Config merging for `.nexus/config.json`.
 *
 * Kept free of the VS Code API so it is unit-testable: `ConfigService` handles I/O and
 * delegates the merge here.
 *
 * Why deep rather than shallow: a shallow spread means any object the user writes
 * *replaces* the default wholesale. A file containing `"mcp": { "enabled": true, … }`
 * with no `approvalTimeoutMs` therefore yielded `undefined` at runtime, which reached
 * `setTimeout(fn, undefined)` and fired on the next tick — so every MCP approval
 * instantly "timed out" and was denied. Missing keys must inherit their default.
 */

/**
 * Paths replaced wholesale instead of merged.
 *
 * These are user-keyed records, where the set of keys is itself user intent. Merging
 * them would resurrect entries the user deleted (the settings panel always writes the
 * whole config, so an absent key means "removed") and could blend fields from two
 * unrelated entries. Everything else — including `mcp.presets` — is merged, so a
 * partial write like `presets: { microsoftLearn: { enabled: false } }` neither deletes
 * `context7` nor drops its stored `apiKey`.
 */
const OPAQUE_PATHS: ReadonlySet<string> = new Set([
  'providers',
  'mcp.customServers',
  'subagents.modeOverrides',
  'routing.modePreferences',
  'routing.chains',
]);

/** `.nexus/config.json` travels with cloned repos, so treat it as untrusted input. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively merges `raw` over `defaults`.
 *
 * Semantics:
 * - absent key or `undefined` → keep the default
 * - `null` → override (lets a user explicitly clear a value)
 * - arrays → **replaced, never concatenated** (concatenating would silently re-add
 *   `routing.fallback.fallbackOn` entries a user removed)
 * - type mismatch → raw wins; downstream guards handle the incoherent value
 */
export function deepMerge(
  defaults: Record<string, unknown>,
  raw: Record<string, unknown>,
  path = '',
): Record<string, unknown> {
  const out: Record<string, unknown> = structuredClone(defaults);

  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_KEYS.has(key)) continue;

    const value = raw[key];
    if (value === undefined) continue;

    const childPath = path ? `${path}.${key}` : key;

    if (OPAQUE_PATHS.has(childPath)) {
      out[key] = structuredClone(value);
      continue;
    }

    if (isPlainObject(out[key]) && isPlainObject(value)) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, value, childPath);
      continue;
    }

    out[key] = structuredClone(value);
  }

  return out;
}

/**
 * Renames the retired `gemini` provider key to `antigravity`.
 *
 * Runs before the merge. Only fires when `antigravity` is absent, so a config carrying
 * both keys is left untouched rather than having one clobber the other.
 */
export function migrateProviderKeys(providers: Record<string, unknown>): Record<string, unknown> {
  if (!('gemini' in providers) || 'antigravity' in providers) {
    return { ...providers };
  }
  const { gemini, ...rest } = providers;
  return { ...rest, antigravity: gemini };
}

export function migrateConfig(raw: Record<string, unknown>): NexusConfig {
  const rawCopy = structuredClone(raw);
  const providers = migrateProviderKeys((rawCopy['providers'] ?? {}) as Record<string, unknown>);
  rawCopy['providers'] = providers;

  const merged = deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    rawCopy,
  ) as unknown as NexusConfig;

  // `providers` is opaque above, so re-apply the original one-level merge verbatim:
  // each provider entry replaces its default wholesale, but unlisted providers keep
  // their defaults.
  merged.providers = { ...DEFAULT_CONFIG.providers, ...providers } as NexusConfig['providers'];

  return merged;
}
