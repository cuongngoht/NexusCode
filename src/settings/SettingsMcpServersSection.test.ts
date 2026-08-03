import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  MCP_SERVERS_CLIENT_SCRIPT,
  renderMcpServersSectionHtml,
} from './SettingsMcpServersSection';
import { SECRET_SENTINEL } from './McpServerModel';
import type { McpCustomServerConfig } from '../config/NexusConfig';

/**
 * Drives the real inline client script inside jsdom. The script is a plain JS
 * string embedded in the settings webview, so this is the only way to cover it —
 * and it is worth covering, because a mistake there silently breaks the whole
 * Settings panel, Save button included.
 */

interface Harness {
  servers: Array<{ name: string; origName: string; cfg: McpCustomServerConfig }>;
  commit: () => boolean;
  handleTestResult: (msg: Record<string, unknown>) => void;
  posted: Array<Record<string, unknown>>;
}

/**
 * Both the markup and the script here are build-time constants from our own
 * module — no external input reaches innerHTML or new Function. This is the only
 * way to execute the panel's inline script, which is a string by necessity.
 */
function mount(customServers: Record<string, McpCustomServerConfig> = {}): Harness {
  document.body.innerHTML = `<div id="status"></div>${renderMcpServersSectionHtml()}`;

  const posted: Array<Record<string, unknown>> = [];
  const vscodeApi = { postMessage: (msg: Record<string, unknown>) => { posted.push(msg); } };
  const base = { mcp: { customServers } };

  // Exposes the script's internals so assertions can reach the live list.
  const epilogue = `
    return {
      get servers() { return mcpServers; },
      commit: mcpCommitDraft,
      handleTestResult: mcpHandleTestResult
    };`;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function('base', 'vscode', MCP_SERVERS_CLIENT_SCRIPT + epilogue);
  const api = factory(base, vscodeApi) as Omit<Harness, 'posted'>;
  return Object.assign(api, { posted }) as Harness;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const rows = (): HTMLElement[] => Array.from(document.querySelectorAll('.mcp-server-row'));
const rowButton = (index: number, action: string): HTMLButtonElement =>
  rows()[index].querySelector(`button[data-mcp-action="${action}"]`) as HTMLButtonElement;

function fillForm(values: {
  name?: string; type?: 'http' | 'stdio'; url?: string; command?: string;
  args?: string; headerKey?: string; headerValue?: string; risk?: string;
}): void {
  if (values.name !== undefined) $<HTMLInputElement>('mcp-f-name').value = values.name;
  if (values.type) {
    $<HTMLSelectElement>('mcp-f-type').value = values.type;
    $('mcp-f-type').dispatchEvent(new Event('change'));
  }
  if (values.url !== undefined) $<HTMLInputElement>('mcp-f-url').value = values.url;
  if (values.command !== undefined) $<HTMLInputElement>('mcp-f-command').value = values.command;
  if (values.args !== undefined) $<HTMLTextAreaElement>('mcp-f-args').value = values.args;
  if (values.risk) $<HTMLSelectElement>('mcp-f-risk').value = values.risk;
  if (values.headerKey !== undefined) {
    const row = document.querySelector('#mcp-headers .mcp-kv-row') as HTMLElement;
    (row.querySelector('.mcp-kv-key') as HTMLInputElement).value = values.headerKey;
    const valueInput = row.querySelector('.mcp-kv-value') as HTMLInputElement;
    valueInput.value = values.headerValue ?? '';
    valueInput.dispatchEvent(new Event('input'));
  }
}

beforeAll(() => {
  // jsdom does not implement scrollIntoView.
  Element.prototype.scrollIntoView = function scrollIntoView() { /* no-op */ };
});

describe('custom MCP servers section — list rendering', () => {
  it('shows an empty state when there are no servers', () => {
    mount();
    expect(rows()).toHaveLength(0);
    expect($('mcp-servers-list').textContent).toContain('No custom MCP servers yet');
  });

  it('renders a saved http server without ever showing the header value', () => {
    mount({
      'portaltalk-docs': {
        type: 'http',
        url: 'https://example.com/mcp',
        headers: { Authorization: 'Bearer SUPERSECRET' },
      },
    });

    expect(rows()).toHaveLength(1);
    expect(rows()[0].querySelector('.provider-name')?.textContent).toBe('portaltalk-docs');
    expect(rows()[0].querySelector('.provider-command')?.textContent)
      .toBe('HTTP · https://example.com/mcp · 1 header');
    expect(document.body.textContent).not.toContain('SUPERSECRET');
  });

  it('marks a disabled server with a badge', () => {
    mount({ off: { type: 'http', url: 'https://e.com/mcp', enabled: false } });
    expect(rows()[0].querySelector('.mcp-badge')?.textContent).toBe('Disabled');
  });

  it('surfaces a server that buildCustomPresets would silently skip', () => {
    const harness = mount({ broken: { type: 'http' } });
    const status = rows()[0].querySelector('[data-mcp-status]') as HTMLElement;
    expect(status.className).toContain('err');
    expect(status.textContent).toContain('needs a valid http:// or https:// URL');
    // Critically, the broken entry is still in the list and will be saved back.
    expect(harness.servers).toHaveLength(1);
  });
});

describe('custom MCP servers section — add flow', () => {
  beforeEach(() => { mount(); });

  it('opens the form and hides the add button', () => {
    $('mcp-add-server').click();
    expect($('mcp-server-form').hidden).toBe(false);
    expect($('mcp-add-server').hidden).toBe(true);
    expect($('mcp-form-title').textContent).toBe('Add MCP Server');
    expect($('mcp-form-commit').textContent).toBe('Add Server');
  });

  it('adds a server with an auth header and closes the form', () => {
    const harness = mount();
    $('mcp-add-server').click();
    fillForm({
      name: 'portaltalk-docs',
      url: 'https://example.com/mcp',
      headerKey: 'Authorization',
      headerValue: 'Bearer tok',
    });
    $('mcp-form-commit').click();

    expect($('mcp-server-form').hidden).toBe(true);
    expect(harness.servers).toHaveLength(1);
    expect(harness.servers[0]).toMatchObject({ name: 'portaltalk-docs', origName: 'portaltalk-docs' });
    expect(harness.servers[0].cfg).toEqual({
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer tok' },
      enabled: true,
      risk: 'high',
    });
    expect(rows()).toHaveLength(1);
  });

  it('defaults a new server to high risk so calls need approval', () => {
    const harness = mount();
    $('mcp-add-server').click();
    fillForm({ name: 'srv', url: 'https://e.com/mcp' });
    $('mcp-form-commit').click();
    expect(harness.servers[0].cfg.risk).toBe('high');
  });

  it('adds a stdio server with args', () => {
    const harness = mount();
    $('mcp-add-server').click();
    fillForm({ name: 'local', type: 'stdio', command: 'npx', args: '-y\nsome-mcp' });
    expect($('mcp-http-fields').hidden).toBe(true);
    expect($('mcp-stdio-fields').hidden).toBe(false);

    $('mcp-form-commit').click();
    expect(harness.servers[0].cfg).toEqual({
      type: 'stdio', command: 'npx', args: ['-y', 'some-mcp'], enabled: true, risk: 'high',
    });
  });
});

describe('custom MCP servers section — validation', () => {
  it('blocks a blank name and adds nothing', () => {
    const harness = mount();
    $('mcp-add-server').click();
    fillForm({ url: 'https://e.com/mcp' });
    expect($('mcp-form-commit').click() as unknown).toBeUndefined();

    expect($('mcp-e-name').hidden).toBe(false);
    expect($('mcp-e-name').textContent).toBe('Name is required.');
    expect($('mcp-f-name').getAttribute('aria-invalid')).toBe('true');
    expect(harness.servers).toHaveLength(0);
    expect($('mcp-server-form').hidden).toBe(false);
  });

  it('blocks a name with characters that would break the preset id', () => {
    mount();
    $('mcp-add-server').click();
    fillForm({ name: 'my server!', url: 'https://e.com/mcp' });
    $('mcp-form-commit').click();
    expect($('mcp-e-name').textContent).toContain('letters, numbers');
  });

  it('blocks a duplicate name', () => {
    const harness = mount({ dup: { type: 'http', url: 'https://e.com/mcp' } });
    $('mcp-add-server').click();
    fillForm({ name: 'dup', url: 'https://other.com/mcp' });
    $('mcp-form-commit').click();
    expect($('mcp-e-name').textContent).toBe('A server named "dup" already exists.');
    expect(harness.servers).toHaveLength(1);
  });

  it('blocks a non-http url', () => {
    mount();
    $('mcp-add-server').click();
    fillForm({ name: 'srv', url: 'ftp://example.com' });
    $('mcp-form-commit').click();
    expect($('mcp-e-url').textContent).toBe('Enter a valid http:// or https:// URL.');
  });

  it('blocks stdio with no command', () => {
    mount();
    $('mcp-add-server').click();
    fillForm({ name: 'srv', type: 'stdio', command: '' });
    $('mcp-form-commit').click();
    expect($('mcp-e-command').textContent).toBe('Command is required for stdio servers.');
  });

  it('clears a previous error once the input is fixed', () => {
    mount();
    $('mcp-add-server').click();
    fillForm({ name: '', url: 'https://e.com/mcp' });
    $('mcp-form-commit').click();
    expect($('mcp-e-name').hidden).toBe(false);

    fillForm({ name: 'fixed' });
    $('mcp-form-commit').click();
    expect($('mcp-e-name').hidden).toBe(true);
    expect($('mcp-server-form').hidden).toBe(true);
  });
});

describe('custom MCP servers section — edit flow', () => {
  const existing: McpCustomServerConfig = {
    type: 'http',
    url: 'https://example.com/mcp',
    headers: { Authorization: SECRET_SENTINEL },
    someFutureField: 42,
  } as unknown as McpCustomServerConfig;

  it('fills the form from the saved server', () => {
    mount({ pt: existing });
    rowButton(0, 'edit').click();

    expect($('mcp-form-title').textContent).toBe('Edit MCP Server');
    expect($('mcp-form-commit').textContent).toBe('Save Server');
    expect($<HTMLInputElement>('mcp-f-name').value).toBe('pt');
    expect($<HTMLInputElement>('mcp-f-url').value).toBe('https://example.com/mcp');
  });

  it('shows a masked secret as empty with an unchanged placeholder', () => {
    mount({ pt: existing });
    rowButton(0, 'edit').click();

    const valueInput = document.querySelector('#mcp-headers .mcp-kv-value') as HTMLInputElement;
    expect(valueInput.type).toBe('password');
    expect(valueInput.value).toBe('');
    expect(valueInput.placeholder).toContain('unchanged');
    expect(valueInput.dataset.mcpKeep).toBe('1');
  });

  it('keeps the sentinel and unknown fields when only the url changes', () => {
    const harness = mount({ pt: existing });
    rowButton(0, 'edit').click();
    fillForm({ url: 'https://changed.com/mcp' });
    $('mcp-form-commit').click();

    expect(harness.servers[0].cfg).toEqual({
      type: 'http',
      url: 'https://changed.com/mcp',
      headers: { Authorization: SECRET_SENTINEL },
      someFutureField: 42,
      enabled: true,
      risk: 'high',
    });
  });

  it('replaces the secret once the user types a new value', () => {
    const harness = mount({ pt: existing });
    rowButton(0, 'edit').click();
    fillForm({ headerKey: 'Authorization', headerValue: 'Bearer fresh' });
    $('mcp-form-commit').click();

    expect(harness.servers[0].cfg.headers).toEqual({ Authorization: 'Bearer fresh' });
  });

  it('keeps origName after a rename so secrets can still be resolved', () => {
    const harness = mount({ pt: existing });
    rowButton(0, 'edit').click();
    fillForm({ name: 'pt-renamed' });
    $('mcp-form-commit').click();

    expect(harness.servers[0].name).toBe('pt-renamed');
    expect(harness.servers[0].origName).toBe('pt');
  });

  it('allows saving an edit without renaming', () => {
    const harness = mount({ pt: existing });
    rowButton(0, 'edit').click();
    $('mcp-form-commit').click();
    expect($('mcp-e-name').hidden).toBe(true);
    expect(harness.servers).toHaveLength(1);
  });

  it('drops http-only keys but keeps unknown ones when switching to stdio', () => {
    const harness = mount({ pt: existing });
    rowButton(0, 'edit').click();
    fillForm({ type: 'stdio', command: 'npx' });
    $('mcp-form-commit').click();

    const cfg = harness.servers[0].cfg as unknown as Record<string, unknown>;
    expect(cfg['url']).toBeUndefined();
    expect(cfg['headers']).toBeUndefined();
    expect(cfg['someFutureField']).toBe(42);
    expect(cfg['command']).toBe('npx');
  });
});

describe('custom MCP servers section — header rows', () => {
  beforeEach(() => {
    mount({ pt: { type: 'http', url: 'https://e.com/mcp' } });
    rowButton(0, 'edit').click();
  });

  it('adds and removes header rows', () => {
    expect(document.querySelectorAll('#mcp-headers .mcp-kv-row')).toHaveLength(1);
    ($('mcp-server-form').querySelector('[data-mcp-action="add-header"]') as HTMLButtonElement).click();
    expect(document.querySelectorAll('#mcp-headers .mcp-kv-row')).toHaveLength(2);

    (document.querySelector('#mcp-headers [data-mcp-action="remove-kv"]') as HTMLButtonElement).click();
    expect(document.querySelectorAll('#mcp-headers .mcp-kv-row')).toHaveLength(1);
  });

  it('toggles a secret between hidden and visible', () => {
    const toggle = document.querySelector('#mcp-headers [data-mcp-action="toggle-secret"]') as HTMLButtonElement;
    const input = document.querySelector('#mcp-headers .mcp-kv-value') as HTMLInputElement;

    expect(input.type).toBe('password');
    toggle.click();
    expect(input.type).toBe('text');
    expect(toggle.textContent).toBe('Hide');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    toggle.click();
    expect(input.type).toBe('password');
    expect(toggle.textContent).toBe('Show');
  });

  it('rejects a header value with no header name', () => {
    fillForm({ headerKey: '', headerValue: 'orphan' });
    $('mcp-form-commit').click();
    expect($('mcp-e-headers').textContent).toBe('Every header needs a name.');
  });
});

describe('custom MCP servers section — delete', () => {
  it('requires two clicks and does not use window.confirm', () => {
    const harness = mount({ a: { type: 'http', url: 'https://a.com/mcp' } });

    rowButton(0, 'delete').click();
    expect(harness.servers).toHaveLength(1);
    expect(rowButton(0, 'delete').textContent).toBe('Confirm delete?');

    rowButton(0, 'delete').click();
    expect(harness.servers).toHaveLength(0);
    expect(rows()).toHaveLength(0);
  });

  it('cancels the pending delete when the form is opened', () => {
    const harness = mount({ a: { type: 'http', url: 'https://a.com/mcp' } });
    rowButton(0, 'delete').click();
    rowButton(0, 'edit').click();
    $('mcp-form-cancel').click();

    expect(rowButton(0, 'delete').textContent).toBe('Delete');
    expect(harness.servers).toHaveLength(1);
  });
});

describe('custom MCP servers section — test connection', () => {
  it('posts a test request for a saved row', () => {
    const harness = mount({ pt: { type: 'http', url: 'https://e.com/mcp' } });
    rowButton(0, 'test').click();

    expect(harness.posted).toHaveLength(1);
    expect(harness.posted[0]).toMatchObject({
      type: 'settings.testMcpServer',
      name: 'pt',
      origName: 'pt',
    });
    expect(harness.posted[0]['requestId']).toBeTruthy();
  });

  it('refuses to test an invalid draft and posts nothing', () => {
    const harness = mount();
    $('mcp-add-server').click();
    fillForm({ name: 'srv', url: 'not-a-url' });
    $('mcp-form-test').click();

    expect(harness.posted).toHaveLength(0);
    expect($('mcp-e-url').hidden).toBe(false);
  });

  it('renders a successful result on the row', () => {
    const harness = mount({ pt: { type: 'http', url: 'https://e.com/mcp' } });
    rowButton(0, 'test').click();
    const requestId = harness.posted[0]['requestId'];

    harness.handleTestResult({ requestId, name: 'pt', ok: true, toolCount: 2, tools: ['search', 'fetch'] });

    const status = rows()[0].querySelector('[data-mcp-status]') as HTMLElement;
    expect(status.textContent).toBe('Connected. 2 tools: search, fetch.');
    expect(status.className).toContain('ok');
  });

  it('renders a failure result on the row', () => {
    const harness = mount({ pt: { type: 'http', url: 'https://e.com/mcp' } });
    rowButton(0, 'test').click();
    harness.handleTestResult({
      requestId: harness.posted[0]['requestId'], name: 'pt', ok: false, code: 'failed', error: 'connect ECONNREFUSED',
    });

    const status = rows()[0].querySelector('[data-mcp-status]') as HTMLElement;
    expect(status.textContent).toBe('connect ECONNREFUSED');
    expect(status.className).toContain('err');
  });

  it('ignores a stale reply whose request is no longer pending', () => {
    const harness = mount({ pt: { type: 'http', url: 'https://e.com/mcp' } });
    rowButton(0, 'test').click();
    const requestId = harness.posted[0]['requestId'];

    harness.handleTestResult({ requestId, name: 'pt', ok: true, toolCount: 1, tools: ['x'] });
    harness.handleTestResult({ requestId, name: 'pt', ok: false, error: 'late failure' });

    const status = rows()[0].querySelector('[data-mcp-status]') as HTMLElement;
    expect(status.textContent).not.toBe('late failure');
  });
});
