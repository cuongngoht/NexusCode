import { describe, it, expect } from 'vitest';
import { buildCustomPresets, customPresetId, isCustomPresetId } from './McpCustomServers';
import { McpToolRouter } from './McpToolRouter';
import type { McpCustomServerConfig } from '../config/NexusConfig';
import type { McpToolIntent } from './McpTypes';

const httpServer: McpCustomServerConfig = {
  type: 'http',
  url: 'https://example.com/mcp',
  headers: { Authorization: 'Bearer secret-token' },
};

describe('buildCustomPresets', () => {
  it('builds a streamableHttp preset with headers from an http entry', () => {
    const entries = buildCustomPresets({ 'portaltalk-docs': httpServer });

    expect(entries).toHaveLength(1);
    const { preset, enabled } = entries[0];
    expect(enabled).toBe(true);
    expect(preset.id).toBe('custom:portaltalk-docs');
    expect(preset.displayName).toBe('portaltalk-docs');
    expect(preset.transport).toBe('streamableHttp');
    expect(preset.endpoint).toBe('https://example.com/mcp');
    expect(preset.headers).toEqual({ Authorization: 'Bearer secret-token' });
  });

  it('builds a stdio preset from a stdio entry', () => {
    const entries = buildCustomPresets({
      local: { type: 'stdio', command: 'npx', args: ['-y', 'some-mcp'], env: { KEY: 'v' } },
    });

    expect(entries).toHaveLength(1);
    const { preset } = entries[0];
    expect(preset.transport).toBe('stdio');
    expect(preset.command).toBe('npx');
    expect(preset.args).toEqual(['-y', 'some-mcp']);
    expect(preset.env).toEqual({ KEY: 'v' });
    expect(preset.endpoint).toBeUndefined();
  });

  it('defaults to high risk so calls go through the approval gate', () => {
    const entries = buildCustomPresets({ 'portaltalk-docs': httpServer });
    expect(entries[0].preset.risk).toBe('high');
  });

  it('honours an explicit risk override', () => {
    const entries = buildCustomPresets({ trusted: { ...httpServer, risk: 'low' } });
    expect(entries[0].preset.risk).toBe('low');
  });

  it('derives bestFor keywords from the server name when not provided', () => {
    const entries = buildCustomPresets({ 'portaltalk-docs': httpServer });
    expect(entries[0].preset.bestFor).toEqual(['portaltalk', 'docs']);
  });

  it('prefers explicit bestFor keywords', () => {
    const entries = buildCustomPresets({ x: { ...httpServer, bestFor: ['sharepoint'] } });
    expect(entries[0].preset.bestFor).toEqual(['sharepoint']);
  });

  it('marks disabled entries as disabled without dropping them', () => {
    const entries = buildCustomPresets({ off: { ...httpServer, enabled: false } });
    expect(entries).toHaveLength(1);
    expect(entries[0].enabled).toBe(false);
  });

  it('skips invalid entries: http without url, non-http url, stdio without command, unknown type', () => {
    const entries = buildCustomPresets({
      'no-url': { type: 'http' },
      'bad-url': { type: 'http', url: 'ftp://example.com' },
      'no-command': { type: 'stdio' },
      weird: { type: 'sse' as unknown as 'http', url: 'https://example.com/mcp' },
      ok: httpServer,
    });

    expect(entries.map(e => e.preset.id)).toEqual(['custom:ok']);
  });

  it('returns an empty list for undefined config', () => {
    expect(buildCustomPresets(undefined)).toEqual([]);
  });
});

describe('custom preset ids', () => {
  it('round-trips through customPresetId / isCustomPresetId', () => {
    expect(isCustomPresetId(customPresetId('portaltalk-docs'))).toBe(true);
    expect(isCustomPresetId('microsoftLearn')).toBe(false);
    expect(isCustomPresetId('context7')).toBe(false);
  });
});

describe('McpToolRouter with custom presets', () => {
  const router = new McpToolRouter();
  const intent: McpToolIntent = { group: 'docs', query: 'portaltalk auth flow', reason: 'need docs' };

  it('routes to the pinned defaultTool when configured', () => {
    const entries = buildCustomPresets({ pt: { ...httpServer, defaultTool: 'search_docs' } });
    const route = router.route(intent, entries[0].preset);

    expect(route.presetId).toBe('custom:pt');
    expect(route.toolName).toBe('search_docs');
    expect(route.arguments).toEqual({ query: 'portaltalk auth flow' });
  });

  it('leaves toolName empty for discovery when no defaultTool is set', () => {
    const entries = buildCustomPresets({ pt: httpServer });
    const route = router.route(intent, entries[0].preset);
    expect(route.toolName).toBe('');
  });
});
