import { describe, it, expect } from 'vitest';
import {
  MCP_NAME_PATTERN,
  SECRET_SENTINEL,
  draftToServerConfig,
  redactConfigSecrets,
  rehydrateConfigSecrets,
  serverConfigToDraft,
  summarizeServer,
  validateMcpServerDraft,
  type McpServerDraft,
} from './McpServerModel';
import { buildCustomPresets } from '../mcp/McpCustomServers';
import type { McpCustomServerConfig } from '../config/NexusConfig';

function draft(overrides: Partial<McpServerDraft> = {}): McpServerDraft {
  return {
    name: 'portaltalk-docs',
    type: 'http',
    url: 'https://example.com/mcp',
    headers: [{ key: 'Authorization', value: 'Bearer secret-token' }],
    command: '',
    args: [],
    env: [],
    enabled: true,
    risk: 'high',
    defaultTool: '',
    bestFor: [],
    ...overrides,
  };
}

describe('validateMcpServerDraft — pinned against buildCustomPresets', () => {
  // The direction that matters: anything the form calls valid MUST survive
  // buildCustomPresets. Otherwise the server is silently dropped at runtime with
  // no UI feedback — the exact bug this form exists to eliminate.
  const cases: Array<{ label: string; draft: McpServerDraft }> = [
    { label: 'http with headers', draft: draft() },
    { label: 'http without headers', draft: draft({ headers: [] }) },
    { label: 'http on plain http://', draft: draft({ url: 'http://localhost:3000/mcp' }) },
    { label: 'stdio with args and env', draft: draft({ type: 'stdio', command: 'npx', args: ['-y', 'some-mcp'], env: [{ key: 'K', value: 'v' }] }) },
    { label: 'stdio minimal', draft: draft({ type: 'stdio', command: 'my-mcp' }) },
    { label: 'disabled server', draft: draft({ enabled: false }) },
    { label: 'low risk with defaultTool', draft: draft({ risk: 'low', defaultTool: 'search_docs' }) },
    { label: 'explicit bestFor', draft: draft({ bestFor: ['sharepoint', 'docs'] }) },
    { label: 'dotted name', draft: draft({ name: 'acme.docs_v2-beta' }) },
  ];

  for (const { label, draft: candidate } of cases) {
    it(`accepts ${label}, and buildCustomPresets also accepts it`, () => {
      expect(validateMcpServerDraft(candidate, [])).toEqual({});

      const cfg = draftToServerConfig(candidate);
      const presets = buildCustomPresets({ [candidate.name]: cfg });
      expect(presets).toHaveLength(1);
      expect(presets[0].enabled).toBe(candidate.enabled);
    });
  }

  const rejected: Array<{ label: string; draft: McpServerDraft }> = [
    { label: 'http without a url', draft: draft({ url: '' }) },
    { label: 'a non-http scheme', draft: draft({ url: 'ftp://example.com' }) },
    { label: 'stdio without a command', draft: draft({ type: 'stdio', command: '' }) },
  ];

  for (const { label, draft: candidate } of rejected) {
    it(`rejects ${label}, and buildCustomPresets drops it too`, () => {
      expect(Object.keys(validateMcpServerDraft(candidate, []))).not.toHaveLength(0);
      expect(buildCustomPresets({ [candidate.name]: draftToServerConfig(candidate) })).toHaveLength(0);
    });
  }
});

describe('validateMcpServerDraft — per-field rules', () => {
  it('requires a name', () => {
    expect(validateMcpServerDraft(draft({ name: '  ' }), [])).toEqual({ name: 'Name is required.' });
  });

  it('rejects characters that would not survive the preset id', () => {
    const errors = validateMcpServerDraft(draft({ name: 'my server!' }), []);
    expect(errors.name).toContain('letters, numbers');
    expect(MCP_NAME_PATTERN.test('my server!')).toBe(false);
  });

  it('rejects a duplicate name', () => {
    const errors = validateMcpServerDraft(draft({ name: 'dup' }), ['dup', 'other']);
    expect(errors.name).toBe('A server named "dup" already exists.');
  });

  it('rejects a case-only duplicate', () => {
    expect(validateMcpServerDraft(draft({ name: 'DUP' }), ['dup']).name).toBeDefined();
  });

  it('allows renaming a server to itself', () => {
    expect(validateMcpServerDraft(draft({ name: 'dup' }), ['dup'], 'dup')).toEqual({});
  });

  it('allows renaming with a case change only', () => {
    expect(validateMcpServerDraft(draft({ name: 'Dup' }), ['dup'], 'dup')).toEqual({});
  });

  it('reports exactly one error for a bad url', () => {
    expect(validateMcpServerDraft(draft({ url: 'nope' }), [])).toEqual({
      url: 'Enter a valid http:// or https:// URL.',
    });
  });

  it('reports a header value with no header name', () => {
    const errors = validateMcpServerDraft(draft({ headers: [{ key: '  ', value: 'orphan' }] }), []);
    expect(errors.headers).toBe('Every header needs a name.');
  });

  it('ignores fully blank header rows', () => {
    expect(validateMcpServerDraft(draft({ headers: [{ key: '', value: '' }] }), [])).toEqual({});
  });

  it('does not validate headers left over from a type switch to stdio', () => {
    const candidate = draft({ type: 'stdio', command: 'npx', headers: [{ key: '', value: 'orphan' }] });
    expect(validateMcpServerDraft(candidate, [])).toEqual({});
  });

  it('reports an env value with no name for stdio', () => {
    const candidate = draft({ type: 'stdio', command: 'npx', env: [{ key: '', value: 'v' }] });
    expect(validateMcpServerDraft(candidate, []).env).toBe('Every environment variable needs a name.');
  });
});

describe('draftToServerConfig / serverConfigToDraft', () => {
  it('round-trips an http server without losing unknown fields', () => {
    const cfg = {
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer t' },
      enabled: true,
      risk: 'high',
      someFutureField: { nested: 1 },
    } as unknown as McpCustomServerConfig;

    const back = draftToServerConfig(serverConfigToDraft('x', cfg), cfg);
    expect(back).toEqual(cfg);
  });

  it('keeps unknown fields when switching http to stdio, and drops http-only keys', () => {
    const cfg = {
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer t' },
      someFutureField: 7,
    } as unknown as McpCustomServerConfig;

    const next = draftToServerConfig(
      { ...serverConfigToDraft('x', cfg), type: 'stdio', command: 'npx', args: ['-y', 'pkg'] },
      cfg,
    ) as Record<string, unknown>;

    expect(next['url']).toBeUndefined();
    expect(next['headers']).toBeUndefined();
    expect(next['command']).toBe('npx');
    expect(next['args']).toEqual(['-y', 'pkg']);
    expect(next['someFutureField']).toBe(7);
  });

  it('drops stdio-only keys when switching to http', () => {
    const cfg: McpCustomServerConfig = { type: 'stdio', command: 'npx', args: ['-y'], env: { K: 'v' } };
    const next = draftToServerConfig(
      { ...serverConfigToDraft('x', cfg), type: 'http', url: 'https://example.com/mcp' },
      cfg,
    ) as Record<string, unknown>;

    expect(next['command']).toBeUndefined();
    expect(next['args']).toBeUndefined();
    expect(next['env']).toBeUndefined();
    expect(next['url']).toBe('https://example.com/mcp');
  });

  it('omits defaultTool and bestFor when blank instead of writing empty values', () => {
    const next = draftToServerConfig(draft({ defaultTool: '   ', bestFor: ['', '  '] })) as Record<string, unknown>;
    expect('defaultTool' in next).toBe(false);
    expect('bestFor' in next).toBe(false);
  });

  it('omits an empty headers map so the entry stays clean', () => {
    const next = draftToServerConfig(draft({ headers: [{ key: '', value: '' }] })) as Record<string, unknown>;
    expect('headers' in next).toBe(false);
  });

  it('sends an untouched masked header back as the sentinel', () => {
    const cfg: McpCustomServerConfig = {
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: SECRET_SENTINEL },
    };
    const asDraft = serverConfigToDraft('x', cfg);
    expect(asDraft.headers).toEqual([{ key: 'Authorization', value: '', keep: true }]);

    const back = draftToServerConfig(asDraft, cfg) as Record<string, unknown>;
    expect(back['headers']).toEqual({ Authorization: SECRET_SENTINEL });
  });

  it('replaces a masked header once the user types a new value', () => {
    const asDraft = draft({ headers: [{ key: 'Authorization', value: 'Bearer fresh', keep: false }] });
    const back = draftToServerConfig(asDraft) as Record<string, unknown>;
    expect(back['headers']).toEqual({ Authorization: 'Bearer fresh' });
  });
});

describe('summarizeServer', () => {
  it('summarizes an http server by header count, never by value', () => {
    const result = summarizeServer({
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer SUPERSECRET' },
    });
    expect(result.line).toBe('HTTP · https://example.com/mcp · 1 header');
    expect(result.line).not.toContain('SUPERSECRET');
    expect(result.problem).toBeUndefined();
  });

  it('summarizes a stdio server by env count, never by value', () => {
    const result = summarizeServer({
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'some-mcp'],
      env: { TOKEN: 'SUPERSECRET', OTHER: 'x' },
    });
    expect(result.line).toBe('stdio · npx -y some-mcp · 2 env vars');
    expect(result.line).not.toContain('SUPERSECRET');
  });

  it('surfaces a lowered risk level', () => {
    expect(summarizeServer({ type: 'http', url: 'https://e.com/mcp', risk: 'low' }).line).toContain('risk: low');
  });

  it('flags an http server with no url as a problem', () => {
    const result = summarizeServer({ type: 'http' });
    expect(result.problem).toContain('needs a valid http:// or https:// URL');
  });

  it('flags a stdio server with no command as a problem', () => {
    expect(summarizeServer({ type: 'stdio' }).problem).toContain('needs a command');
  });

  it('flags an unsupported type', () => {
    expect(summarizeServer({ type: 'sse' } as unknown as McpCustomServerConfig).problem).toContain('Unsupported type');
  });
});

describe('redactConfigSecrets', () => {
  const config = {
    mcp: {
      enabled: true,
      maxResultChars: 6000,
      presets: { microsoftLearn: { enabled: true }, context7: { enabled: true, apiKey: 'ctx7-key' } },
      customServers: {
        pt: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer t' } },
        local: { type: 'stdio', command: 'npx', env: { TOKEN: 'env-secret' } },
      },
    },
    providers: { claude: { enabled: true, command: 'claude' } },
  };

  it('masks exactly the three secret locations and nothing else', () => {
    expect(redactConfigSecrets(config)).toEqual({
      mcp: {
        enabled: true,
        maxResultChars: 6000,
        presets: { microsoftLearn: { enabled: true }, context7: { enabled: true, apiKey: SECRET_SENTINEL } },
        customServers: {
          pt: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: SECRET_SENTINEL } },
          local: { type: 'stdio', command: 'npx', env: { TOKEN: SECRET_SENTINEL } },
        },
      },
      providers: { claude: { enabled: true, command: 'claude' } },
    });
  });

  it('does not mutate the input', () => {
    const snapshot = structuredClone(config);
    redactConfigSecrets(config);
    expect(config).toEqual(snapshot);
  });

  it('leaves an empty apiKey alone rather than masking nothing', () => {
    const result = redactConfigSecrets({ mcp: { presets: { context7: { enabled: true, apiKey: '' } } } });
    expect(result.mcp.presets.context7.apiKey).toBe('');
  });

  it('tolerates a config with no mcp section', () => {
    expect(redactConfigSecrets({ providers: {} })).toEqual({ providers: {} });
  });
});

describe('rehydrateConfigSecrets', () => {
  const onDisk = {
    mcp: {
      presets: { context7: { enabled: true, apiKey: 'ctx7-key' } },
      customServers: {
        pt: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer real' } },
        local: { type: 'stdio', command: 'npx', env: { TOKEN: 'env-real' } },
      },
    },
  };

  it('restores header, env and apiKey secrets', () => {
    const payload = structuredClone(redactConfigSecrets(onDisk));
    rehydrateConfigSecrets(payload, onDisk, {});
    expect(payload).toEqual(onDisk);
  });

  it('follows the origins map so a renamed server keeps its secret', () => {
    const payload = {
      mcp: {
        customServers: {
          'pt-renamed': { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: SECRET_SENTINEL } },
        },
      },
    };
    rehydrateConfigSecrets(payload, onDisk, { 'pt-renamed': 'pt' });
    expect(payload.mcp.customServers['pt-renamed'].headers.Authorization).toBe('Bearer real');
  });

  it('deletes an unresolvable sentinel instead of ever writing it to disk', () => {
    const payload = {
      mcp: {
        customServers: {
          brand_new: { type: 'http', url: 'https://new.com/mcp', headers: { Authorization: SECRET_SENTINEL, 'X-Real': 'kept' } },
        },
      },
    };
    rehydrateConfigSecrets(payload, onDisk, {});

    const headers = payload.mcp.customServers.brand_new.headers as Record<string, string>;
    expect('Authorization' in headers).toBe(false);
    expect(headers['X-Real']).toBe('kept');
    expect(JSON.stringify(payload)).not.toContain(SECRET_SENTINEL);
  });

  it('deletes an unresolvable context7 apiKey sentinel', () => {
    const payload = { mcp: { presets: { context7: { enabled: true, apiKey: SECRET_SENTINEL } } } };
    rehydrateConfigSecrets(payload, { mcp: { presets: {} } }, {});
    expect('apiKey' in payload.mcp.presets.context7).toBe(false);
  });

  it('leaves a freshly typed value untouched', () => {
    const payload = {
      mcp: { customServers: { pt: { type: 'http', url: 'https://e.com/mcp', headers: { Authorization: 'Bearer typed' } } } },
    };
    rehydrateConfigSecrets(payload, onDisk, {});
    expect(payload.mcp.customServers.pt.headers.Authorization).toBe('Bearer typed');
  });

  it('tolerates a missing on-disk config entirely', () => {
    const payload = { mcp: { customServers: { pt: { type: 'http', url: 'https://e.com/mcp', headers: { A: SECRET_SENTINEL } } } } };
    rehydrateConfigSecrets(payload, undefined, {});
    expect(payload.mcp.customServers.pt.headers).toEqual({});
  });
});
