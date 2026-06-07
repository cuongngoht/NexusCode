import { describe, it, expect } from 'vitest';
import { McpToolRouter } from './McpToolRouter';
import type { McpPreset, McpToolIntent } from './McpTypes';

const router = new McpToolRouter();

const microsoftLearnPreset: McpPreset = {
  id: 'microsoftLearn',
  displayName: 'Microsoft Learn',
  description: 'Official Microsoft docs',
  transport: 'streamableHttp',
  endpoint: 'https://learn.microsoft.com/api/mcp',
  priority: 90,
  enabledByDefault: true,
  bestFor: ['azure'],
  toolGroups: ['docs', 'samples', 'microsoft-docs'],
  risk: 'low',
};

const context7Preset: McpPreset = {
  id: 'context7',
  displayName: 'Context7',
  description: 'Library docs',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@upstash/context7-mcp'],
  priority: 85,
  enabledByDefault: true,
  bestFor: ['react'],
  toolGroups: ['docs', 'samples', 'library-api'],
  risk: 'low',
};

describe('McpToolRouter', () => {
  it('maps docs group to microsoft_docs_search for Microsoft Learn', () => {
    const intent: McpToolIntent = { group: 'docs', query: 'Azure docs', reason: 'need azure' };
    const route = router.route(intent, microsoftLearnPreset);
    expect(route.toolName).toBe('microsoft_docs_search');
    expect(route.arguments).toEqual({ query: 'Azure docs' });
    expect(route.presetId).toBe('microsoftLearn');
  });

  it('maps samples group to microsoft_code_sample_search for Microsoft Learn', () => {
    const intent: McpToolIntent = { group: 'samples', query: 'Azure blob sample', reason: 'need samples' };
    const route = router.route(intent, microsoftLearnPreset);
    expect(route.toolName).toBe('microsoft_code_sample_search');
    expect(route.arguments).toEqual({ query: 'Azure blob sample' });
  });

  it('maps any group to query-docs for Context7', () => {
    const intent: McpToolIntent = { group: 'library-api', query: 'React hooks', reason: 'need api' };
    const route = router.route(intent, context7Preset);
    expect(route.toolName).toBe('query-docs');
    expect(route.arguments).toEqual({ query: 'React hooks' });
    expect(route.presetId).toBe('context7');
  });

  it('preserves the reason in the route', () => {
    const intent: McpToolIntent = { group: 'docs', query: 'something', reason: 'my reason' };
    const route = router.route(intent, context7Preset);
    expect(route.reason).toBe('my reason');
  });

  it('throws on unsupported preset', () => {
    const unsupported = { id: 'unknown', transport: 'stdio' } as unknown as McpPreset;
    const intent: McpToolIntent = { group: 'docs', query: 'q', reason: 'r' };
    expect(() => router.route(intent, unsupported)).toThrow('Unsupported MCP preset: unknown');
  });
});
