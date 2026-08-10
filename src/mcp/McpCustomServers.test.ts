import { describe, it, expect } from 'vitest';
import { buildCustomPresets, customPresetId, isCustomPresetId, pickToolNameForIntent } from './McpCustomServers';
import { McpToolRouter } from './McpToolRouter';
import type { McpCustomServerConfig } from '../config/NexusConfig';
import type { McpToolDescriptor, McpToolIntent } from './McpTypes';

const httpServer: McpCustomServerConfig = {
  type: 'http',
  url: 'https://example.com/mcp',
  headers: { Authorization: 'Bearer secret-token' },
};

describe('buildCustomPresets', () => {
  it('builds a streamableHttp preset with headers from an http entry', () => {
    const entries = buildCustomPresets({ 'nexus-docs': httpServer });

    expect(entries).toHaveLength(1);
    const { preset, enabled } = entries[0];
    expect(enabled).toBe(true);
    expect(preset.id).toBe('custom:nexus-docs');
    expect(preset.displayName).toBe('nexus-docs');
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
    const entries = buildCustomPresets({ 'nexus-docs': httpServer });
    expect(entries[0].preset.risk).toBe('high');
  });

  it('honours an explicit risk override', () => {
    const entries = buildCustomPresets({ trusted: { ...httpServer, risk: 'low' } });
    expect(entries[0].preset.risk).toBe('low');
  });

  it('derives bestFor keywords from the server name when not provided', () => {
    const entries = buildCustomPresets({ 'nexus-docs': httpServer });
    expect(entries[0].preset.bestFor).toEqual(['nexus', 'docs']);
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
    expect(isCustomPresetId(customPresetId('nexus-docs'))).toBe(true);
    expect(isCustomPresetId('microsoftLearn')).toBe(false);
    expect(isCustomPresetId('context7')).toBe(false);
  });
});

describe('McpToolRouter with custom presets', () => {
  const router = new McpToolRouter();
  const intent: McpToolIntent = { group: 'docs', query: 'nexus auth flow', reason: 'need docs' };

  it('routes to the pinned defaultTool when configured', () => {
    const entries = buildCustomPresets({ pt: { ...httpServer, defaultTool: 'search_docs' } });
    const route = router.route(intent, entries[0].preset);

    expect(route.presetId).toBe('custom:pt');
    expect(route.toolName).toBe('search_docs');
    expect(route.arguments).toEqual({ query: 'nexus auth flow' });
  });

  it('leaves toolName empty for discovery when no defaultTool is set', () => {
    const entries = buildCustomPresets({ pt: httpServer });
    const route = router.route(intent, entries[0].preset);
    expect(route.toolName).toBe('');
  });
});

describe('pickToolNameForIntent', () => {
  const tool = (name: string, description?: string): McpToolDescriptor => ({ name, description });
  const docsIntent: McpToolIntent = { group: 'docs', query: 'q', reason: 'r' };
  const samplesIntent: McpToolIntent = { group: 'samples', query: 'q', reason: 'r' };

  it('prefers a retrieval tool over an unrelated one', () => {
    const tools = [tool('list_projects'), tool('search_docs')];
    expect(pickToolNameForIntent(tools, docsIntent)).toBe('search_docs');
  });

  it('prefers a sample-specific tool for the samples group', () => {
    const tools = [tool('search_docs'), tool('search_code_samples')];
    expect(pickToolNameForIntent(tools, samplesIntent)).toBe('search_code_samples');
  });

  it('prefers the docs tool over the samples tool for a docs intent', () => {
    const tools = [tool('search_code_samples'), tool('search_docs')];
    expect(pickToolNameForIntent(tools, docsIntent)).toBe('search_docs');
  });

  it('keeps the server-advertised order on a genuine tie', () => {
    const tools = [tool('search_alpha'), tool('search_beta')];
    expect(pickToolNameForIntent(tools, docsIntent)).toBe('search_alpha');
  });

  // A documentation intent must never trip a write on an arbitrary user-configured
  // server, so mutating verbs are penalised rather than merely unranked.
  it('avoids a mutating tool even when its name also contains a retrieval verb', () => {
    const tools = [tool('create_doc'), tool('find_doc')];
    expect(pickToolNameForIntent(tools, docsIntent)).toBe('find_doc');
  });

  it('returns undefined when only mutating tools are advertised', () => {
    const tools = [tool('delete_page'), tool('update_record')];
    expect(pickToolNameForIntent(tools, docsIntent)).toBeUndefined();
  });

  it('returns undefined when nothing scores, so the caller can fall back to tools[0]', () => {
    expect(pickToolNameForIntent([tool('alpha'), tool('beta')], docsIntent)).toBeUndefined();
    expect(pickToolNameForIntent([], docsIntent)).toBeUndefined();
  });

  it('scores a name match above a description-only match', () => {
    const tools = [tool('alpha', 'can search the docs'), tool('search_alpha')];
    expect(pickToolNameForIntent(tools, docsIntent)).toBe('search_alpha');
  });

  it('can still select on description alone when no name matches', () => {
    const tools = [tool('alpha'), tool('beta', 'Search the knowledge base')];
    expect(pickToolNameForIntent(tools, docsIntent)).toBe('beta');
  });
});
