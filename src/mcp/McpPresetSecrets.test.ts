import { describe, it, expect } from 'vitest';
import { applyPresetSecrets } from './McpPresetSecrets';
import type { McpConfig } from '../config/NexusConfig';
import type { McpPreset } from './McpTypes';
import { DEFAULT_CONFIG } from '../config/DefaultConfig';

const context7Preset = (env?: Record<string, string>): McpPreset => ({
  id: 'context7',
  displayName: 'Context7',
  description: 'Library docs',
  transport: 'stdio',
  priority: 85,
  enabledByDefault: true,
  bestFor: ['library'],
  toolGroups: ['library-api'],
  risk: 'low',
  command: 'npx',
  args: ['-y', '@upstash/context7-mcp'],
  env,
});

const configWithKey = (apiKey: string): McpConfig => ({
  ...structuredClone(DEFAULT_CONFIG.mcp),
  presets: { microsoftLearn: { enabled: true }, context7: { enabled: true, apiKey } },
});

describe('applyPresetSecrets', () => {
  it('maps a configured context7 apiKey onto CONTEXT7_API_KEY', () => {
    const result = applyPresetSecrets(context7Preset(), configWithKey('ctx7-secret'));
    expect(result.env).toEqual({ CONTEXT7_API_KEY: 'ctx7-secret' });
  });

  it('leaves the preset untouched when no key is configured', () => {
    const preset = context7Preset();
    expect(applyPresetSecrets(preset, configWithKey(''))).toBe(preset);
    expect(applyPresetSecrets(preset, configWithKey('   '))).toBe(preset);
  });

  it('does not materialise an env object when there is no key', () => {
    expect(applyPresetSecrets(context7Preset(), configWithKey('')).env).toBeUndefined();
  });

  it('preserves existing env entries', () => {
    const result = applyPresetSecrets(context7Preset({ EXISTING: 'keep' }), configWithKey('k'));
    expect(result.env).toEqual({ EXISTING: 'keep', CONTEXT7_API_KEY: 'k' });
  });

  it('does not mutate the input preset', () => {
    const preset = context7Preset();
    applyPresetSecrets(preset, configWithKey('k'));
    expect(preset.env).toBeUndefined();
  });

  it('ignores presets other than context7', () => {
    const other = { ...context7Preset(), id: 'microsoftLearn' as const };
    expect(applyPresetSecrets(other, configWithKey('k'))).toBe(other);
  });

  it('survives a config with no presets object at all', () => {
    const broken = { enabled: true } as unknown as McpConfig;
    expect(() => applyPresetSecrets(context7Preset(), broken)).not.toThrow();
  });
});
