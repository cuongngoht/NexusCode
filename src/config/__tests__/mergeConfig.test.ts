import { describe, it, expect } from 'vitest';
import { deepMerge, migrateConfig, migrateProviderKeys } from '../mergeConfig';
import { DEFAULT_CONFIG } from '../DefaultConfig';

describe('migrateConfig — MCP defaults', () => {
  // The bug this whole suite exists for: the previous shallow spread let a user's `mcp`
  // object replace the default wholesale, so a config that simply didn't mention
  // approvalTimeoutMs produced `undefined` → setTimeout(fn, undefined) → instant
  // "timeout" → every high-risk MCP call silently denied.
  it('fills in approvalTimeoutMs for the real .nexus/config.json shape', () => {
    const raw = {
      version: 1,
      mcp: {
        enabled: true,
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

    const merged = migrateConfig(raw);

    expect(merged.mcp.approvalTimeoutMs).toBe(120_000);
    expect(merged.mcp.enabled).toBe(true);
    expect(merged.mcp.customServers).toEqual({});
  });

  it('keeps every other mcp default when only `enabled` is written', () => {
    const merged = migrateConfig({ mcp: { enabled: true } });

    expect(merged.mcp.approvalTimeoutMs).toBe(120_000);
    expect(merged.mcp.maxResultChars).toBe(DEFAULT_CONFIG.mcp.maxResultChars);
    expect(merged.mcp.presets.microsoftLearn.enabled).toBe(true);
    expect(merged.mcp.presets.context7.enabled).toBe(true);
  });

  it('merges mcp.presets so a partial write does not delete the other preset or its apiKey', () => {
    const merged = migrateConfig({
      mcp: {
        enabled: true,
        presets: { microsoftLearn: { enabled: false } },
      },
    });

    expect(merged.mcp.presets.microsoftLearn.enabled).toBe(false);
    expect(merged.mcp.presets.context7).toBeDefined();
    expect(merged.mcp.presets.context7.apiKey).toBe('');
  });

  it('preserves a stored context7 apiKey when only `enabled` is rewritten', () => {
    const merged = migrateConfig({
      mcp: { presets: { context7: { enabled: true, apiKey: 'secret-key' } } },
    });
    expect(merged.mcp.presets.context7.apiKey).toBe('secret-key');
  });
});

describe('migrateConfig — opaque user-keyed records', () => {
  it('replaces mcp.customServers wholesale so a deletion sticks', () => {
    const defaults = { mcp: { customServers: { a: { type: 'http' }, b: { type: 'stdio' } } } };
    const merged = deepMerge(defaults, { mcp: { customServers: { a: { type: 'http' } } } });

    const servers = (merged.mcp as Record<string, unknown>).customServers as Record<string, unknown>;
    expect(Object.keys(servers)).toEqual(['a']);
  });

  it('does not blend fields from two unrelated custom servers', () => {
    const defaults = { mcp: { customServers: { a: { type: 'stdio', command: 'old', args: ['x'] } } } };
    const merged = deepMerge(defaults, { mcp: { customServers: { a: { type: 'http', url: 'https://e.com' } } } });

    const a = ((merged.mcp as Record<string, unknown>).customServers as Record<string, unknown>)['a'];
    expect(a).toEqual({ type: 'http', url: 'https://e.com' });
    expect(a).not.toHaveProperty('command');
  });

  it('replaces subagents.modeOverrides wholesale rather than resurrecting removed modes', () => {
    const merged = migrateConfig({
      subagents: { modeOverrides: { debug: { preset: 'fast', maxRuns: 1 } } },
    });
    expect(Object.keys(merged.subagents.modeOverrides ?? {})).toEqual(['debug']);
  });
});

describe('deepMerge semantics', () => {
  it('replaces arrays instead of concatenating them', () => {
    const merged = migrateConfig({
      routing: { fallback: { fallbackOn: ['timeout'] } },
    });
    expect(merged.routing.fallback.fallbackOn).toEqual(['timeout']);
  });

  it('keeps sibling keys when merging a nested object', () => {
    const merged = migrateConfig({ routing: { fallback: { maxAttempts: 9 } } });
    expect(merged.routing.fallback.maxAttempts).toBe(9);
    expect(merged.routing.fallback.enabled).toBe(DEFAULT_CONFIG.routing.fallback.enabled);
  });

  it('treats an absent key as "keep the default" and an explicit null as an override', () => {
    expect(deepMerge({ a: 1, b: 2 }, { b: undefined })).toEqual({ a: 1, b: 2 });
    expect(deepMerge({ a: 1 }, { a: null })).toEqual({ a: null });
  });

  it('lets raw win on a type mismatch instead of producing a hybrid', () => {
    expect(deepMerge({ mcp: { enabled: false } }, { mcp: 5 })).toEqual({ mcp: 5 });
  });

  it('does not mutate the defaults it was given', () => {
    const defaults = { nested: { value: 1 } };
    deepMerge(defaults, { nested: { value: 2 } });
    expect(defaults.nested.value).toBe(1);
  });

  it('ignores prototype-polluting keys from an untrusted config file', () => {
    const raw = JSON.parse('{"__proto__": {"polluted": true}, "mcp": {"enabled": true}}');
    const merged = deepMerge({ mcp: { enabled: false } }, raw);

    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect((merged as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('migrateConfig — resilience', () => {
  it('does not throw on a non-object mcp value', () => {
    expect(() => migrateConfig({ mcp: null })).not.toThrow();
    expect(() => migrateConfig({ mcp: 5 })).not.toThrow();
    expect(() => migrateConfig({})).not.toThrow();
  });

  it('returns the full default shape for an empty config', () => {
    const merged = migrateConfig({});
    expect(merged.mcp).toEqual(DEFAULT_CONFIG.mcp);
    expect(merged.routing.fallback.fallbackOn).toEqual(DEFAULT_CONFIG.routing.fallback.fallbackOn);
  });
});

describe('migrateProviderKeys', () => {
  it('renames gemini to antigravity when antigravity is absent', () => {
    const result = migrateProviderKeys({ gemini: { enabled: true, command: 'gemini' } });
    expect(result).toEqual({ antigravity: { enabled: true, command: 'gemini' } });
    expect(result).not.toHaveProperty('gemini');
  });

  it('leaves both keys alone when antigravity already exists', () => {
    const input = { gemini: { command: 'gemini' }, antigravity: { command: 'agy' } };
    expect(migrateProviderKeys(input)).toEqual(input);
  });

  it('passes through when there is no gemini key', () => {
    expect(migrateProviderKeys({ codex: { enabled: true } })).toEqual({ codex: { enabled: true } });
  });

  it('is applied by migrateConfig, and unlisted providers keep their defaults', () => {
    const merged = migrateConfig({ providers: { gemini: { enabled: true, command: 'gemini' } } });
    expect(merged.providers.antigravity).toEqual({ enabled: true, command: 'gemini' });
    expect(merged.providers.codex).toEqual(DEFAULT_CONFIG.providers.codex);
  });
});
