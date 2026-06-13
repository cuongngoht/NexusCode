import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { NexusConfig } from '../config/NexusConfig';
import { DEFAULT_CONFIG } from '../config/DefaultConfig';

const PROVIDER_LABELS: Record<string, string> = {
  antigravity: 'Antigravity CLI',
  codex: 'Codex CLI',
  claude: 'Claude CLI',
  copilot: 'Copilot CLI',
  aider: 'Aider',
  grok: 'Grok CLI',
};

export function getSettingsHtml(
  webview: vscode.Webview,
  config: NexusConfig,
  vsCodeConfig?: { historyRagEnabled?: boolean },
): string {
  const nonce = crypto.randomBytes(16).toString('hex');

  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  const rows = (Object.keys(config.providers) as (keyof NexusConfig['providers'])[])
    .map((id) => {
      const p = config.providers[id];
      const label = PROVIDER_LABELS[id] ?? id;
      const checked = p.enabled ? 'checked' : '';
      return /* html */`
        <div class="provider-row" data-provider="${escapeHtml(String(id))}">
          <div class="provider-main">
            <label>
              <input type="checkbox" name="${id}" ${checked} />
              <span class="provider-name">${escapeHtml(label)}</span>
            </label>
            <div class="provider-actions" data-provider-actions="${escapeHtml(String(id))}"></div>
          </div>
          <div class="provider-command">Command: <code>${escapeHtml(p.command)}</code></div>
          <div class="provider-status muted" data-provider-status="${escapeHtml(String(id))}">Not scanned yet.</div>
        </div>`;
    })
    .join('\n');

  // Merge config with defaults to ensure mcp field is always present
  const mergedConfig: NexusConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    mcp: { ...DEFAULT_CONFIG.mcp, ...(config.mcp ?? {}) },
  };
  const safeJson = JSON.stringify(mergedConfig).replace(/<\/script>/gi, '<\\/script>');
  const mcpEnabled = mergedConfig.mcp.enabled;
  const mcpAutoSelect = mergedConfig.mcp.autoSelectPreset;
  const mcpMicrosoftLearn = mergedConfig.mcp.presets.microsoftLearn.enabled;
  const mcpContext7 = mergedConfig.mcp.presets.context7.enabled;
  const mcpMaxChars = mergedConfig.mcp.maxResultChars;
  const mcpMaxRounds = mergedConfig.mcp.maxRoundsPerTask;
  const historyRagEnabled = vsCodeConfig?.historyRagEnabled ?? mergedConfig.historyRag?.enabled ?? true;

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nexus Settings</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px 32px;
      margin: 0;
    }
    h1 {
      font-size: 1.4em;
      font-weight: 600;
      margin: 0 0 4px;
      color: var(--vscode-foreground);
    }
    h2 {
      font-size: 1em;
      font-weight: 600;
      margin: 24px 0 4px;
      color: var(--vscode-foreground);
    }
    .section-desc {
      font-size: 0.875em;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 12px;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .section-header h2 {
      margin: 0;
    }
    h3 {
      font-size: 0.9em;
      font-weight: 600;
      margin: 16px 0 8px;
      color: var(--vscode-foreground);
    }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .toggle-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .form-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .form-row input[type="number"] {
      width: 80px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 0.9em;
      font-family: var(--vscode-font-family);
    }
    .description {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 8px 24px;
    }
    .settings-section {
      margin-top: 20px;
    }
    .provider-row {
      margin-bottom: 14px;
    }
    .provider-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .provider-row label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .provider-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .provider-name {
      font-weight: 500;
    }
    .provider-command {
      margin-top: 2px;
      margin-left: 24px;
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }
    .provider-status {
      margin-top: 3px;
      margin-left: 24px;
      font-size: 0.8em;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .provider-status.ok {
      color: var(--vscode-testing-iconPassed);
    }
    .provider-status.warn {
      color: var(--vscode-testing-iconQueued);
    }
    .provider-status.err {
      color: var(--vscode-errorForeground);
    }
    .provider-status.muted {
      color: var(--vscode-descriptionForeground);
    }
    .provider-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .provider-action-btn {
      padding: 3px 9px;
      background: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-secondaryBackground);
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.8em;
      font-family: var(--vscode-font-family);
      white-space: nowrap;
    }
    .provider-action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .save-btn {
      margin-top: 24px;
      padding: 6px 18px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.9em;
      font-family: var(--vscode-font-family);
    }
    .save-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .scan-btn {
      padding: 4px 12px;
      background: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-secondaryBackground);
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85em;
      font-family: var(--vscode-font-family);
    }
    .scan-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .scan-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .status {
      margin-top: 10px;
      font-size: 0.85em;
      min-height: 1.2em;
    }
    .status.ok  { color: var(--vscode-testing-iconPassed); }
    .status.err { color: var(--vscode-errorForeground); }
    hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>Nexus Settings</h1>
  <hr />
  <h2>General</h2>
  <div class="section-header">
    <h2>CLI Providers</h2>
    <button class="scan-btn" id="scanBtn">Scan for CLIs</button>
  </div>
  <p class="section-desc">Choose which local CLI tools Nexus can use.</p>

  <div id="providers">${rows}</div>

  <section class="settings-section">
    <hr />
    <h2>MCP Tools</h2>
    <label class="toggle-row">
      <input type="checkbox" id="mcp-enabled" ${mcpEnabled ? 'checked' : ''} />
      <span>Enable MCP</span>
    </label>

    <h3>Trusted Documentation Presets</h3>
    <label class="toggle-row">
      <input type="checkbox" id="mcp-preset-microsoftLearn" ${mcpMicrosoftLearn ? 'checked' : ''} />
      <span>Microsoft Learn</span>
    </label>
    <p class="description">Official Microsoft documentation, Azure, .NET, VS Code, Windows.</p>

    <label class="toggle-row">
      <input type="checkbox" id="mcp-preset-context7" ${mcpContext7 ? 'checked' : ''} />
      <span>Context7</span>
    </label>
    <p class="description">Up-to-date package/library documentation and code examples.</p>

    <h3>Behavior</h3>
    <label class="toggle-row">
      <input type="checkbox" id="mcp-auto-select" ${mcpAutoSelect ? 'checked' : ''} />
      <span>Auto-select best preset</span>
    </label>
    <label class="form-row">
      <span>Max result size (chars):</span>
      <input type="number" id="mcp-max-chars" min="1000" max="20000" step="1000" value="${mcpMaxChars}" />
    </label>
    <label class="form-row">
      <span>Max MCP rounds per task:</span>
      <input type="number" id="mcp-max-rounds" min="1" max="5" value="${mcpMaxRounds}" />
    </label>
  </section>

  <section class="settings-section">
    <hr />
    <h2>History RAG</h2>
    <p class="section-desc">Automatically inject relevant past conversations as context before each task.</p>
    <label class="toggle-row">
      <input type="checkbox" id="history-rag-enabled" ${historyRagEnabled ? 'checked' : ''} />
      <span>Enable History RAG</span>
    </label>
    <p class="description">When enabled, Nexus searches previous conversations and injects relevant snippets into every prompt automatically.</p>
  </section>

  <button class="save-btn" id="saveBtn">Save Settings</button>
  <div class="status" id="status"></div>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const base = ${safeJson};
      const providerRows = document.getElementById('providers');

      function setProviderStatus(id, text, className) {
        const el = document.querySelector('[data-provider-status="' + id + '"]');
        if (!el) return;
        el.textContent = text;
        el.className = 'provider-status ' + className;
      }

      function clearProviderActions(id) {
        const el = document.querySelector('[data-provider-actions="' + id + '"]');
        if (el) el.textContent = '';
        return el;
      }

      function addProviderButton(container, id, action, label) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'provider-action-btn';
        btn.textContent = label;
        btn.dataset.providerAction = action;
        btn.dataset.providerId = id;
        container.appendChild(btn);
      }

      function renderProviderInfo(info) {
        const actions = clearProviderActions(info.id);
        if (!actions) return;

        if (!info.installed) {
          const reason = info.reason ? ' (' + info.reason + ')' : '';
          setProviderStatus(info.id, 'Not installed' + reason, 'err');
          if (info.installCommand) {
            addProviderButton(actions, info.id, 'install', 'Install CLI');
          }
          return;
        }

        const version = info.version ? ' ' + info.version : '';
        const path = info.executablePath ? ' at ' + info.executablePath : '';
        const auth = info.authStatus === 'authenticated'
          ? 'Auth: authenticated.'
          : info.authStatus === 'unauthenticated'
            ? 'Auth: not logged in.'
            : 'Auth not verified.';
        const statusClass = info.authStatus === 'unauthenticated'
          ? 'warn'
          : info.authStatus === 'authenticated'
            ? 'ok'
            : 'muted';
        setProviderStatus(info.id, 'Installed' + version + path + '. ' + auth, statusClass);
        if (info.authStatus === 'unauthenticated' && info.loginCommand) {
          addProviderButton(actions, info.id, 'login', 'Login');
        }
      }

      document.getElementById('scanBtn').addEventListener('click', function () {
        const btn = document.getElementById('scanBtn');
        btn.disabled = true;
        btn.textContent = 'Scanning…';
        document.getElementById('status').textContent = '';
        document.querySelectorAll('#providers input[type=checkbox]').forEach(function (cb) {
          setProviderStatus(cb.name, 'Scanning…', 'muted');
          clearProviderActions(cb.name);
        });
        vscode.postMessage({ type: 'settings.scan' });
      });

      providerRows.addEventListener('click', function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const btn = target.closest('button[data-provider-action]');
        if (!btn) return;
        const action = btn.dataset.providerAction;
        const providerId = btn.dataset.providerId;
        if (!providerId) return;
        if (action === 'install') {
          vscode.postMessage({ type: 'settings.installProvider', providerId: providerId });
          document.getElementById('status').textContent = 'Install command opened in terminal. Review it and press Enter to run.';
          document.getElementById('status').className = 'status ok';
        } else if (action === 'login') {
          vscode.postMessage({ type: 'settings.loginProvider', providerId: providerId });
          document.getElementById('status').textContent = 'Login command opened in terminal. Review it and press Enter to run.';
          document.getElementById('status').className = 'status ok';
        }
      });

      document.getElementById('saveBtn').addEventListener('click', function () {
        const checkboxes = document.querySelectorAll('#providers input[type=checkbox]');
        const providers = Object.assign({}, base.providers);
        checkboxes.forEach(function (cb) {
          const id = cb.name;
          if (providers[id]) {
            providers[id] = Object.assign({}, providers[id], { enabled: cb.checked });
          }
        });
        const mcp = {
          enabled: document.getElementById('mcp-enabled').checked,
          autoSelectPreset: document.getElementById('mcp-auto-select').checked,
          requireApprovalForHighRiskTools: base.mcp.requireApprovalForHighRiskTools,
          maxResultChars: parseInt(document.getElementById('mcp-max-chars').value, 10) || base.mcp.maxResultChars,
          maxRoundsPerTask: parseInt(document.getElementById('mcp-max-rounds').value, 10) || base.mcp.maxRoundsPerTask,
          presets: {
            microsoftLearn: { enabled: document.getElementById('mcp-preset-microsoftLearn').checked },
            context7: {
              enabled: document.getElementById('mcp-preset-context7').checked,
              apiKey: base.mcp.presets.context7.apiKey || '',
            },
          },
        };
        const historyRag = {
          enabled: document.getElementById('history-rag-enabled').checked,
          maxResults: base.historyRag ? base.historyRag.maxResults : 5,
          maxChars: base.historyRag ? base.historyRag.maxChars : 6000,
          minScore: base.historyRag ? base.historyRag.minScore : 1.25,
        };
        const config = Object.assign({}, base, { providers: providers, mcp: mcp, historyRag: historyRag });
        vscode.postMessage({ type: 'settings.save', payload: config });
      });

      window.addEventListener('message', function (event) {
        const msg = event.data;
        const status = document.getElementById('status');

        if (msg.type === 'settings.scanResult') {
          const btn = document.getElementById('scanBtn');
          btn.disabled = false;
          btn.textContent = 'Scan for CLIs';
          const detectionMap = {};
          (msg.detection || []).forEach(function (d) { detectionMap[d.id] = d; });
          const checkboxes = document.querySelectorAll('#providers input[type=checkbox]');
          checkboxes.forEach(function (cb) {
            const info = detectionMap[cb.name];
            if (info !== undefined) {
              cb.checked = info.installed;
              renderProviderInfo(info);
            } else {
              setProviderStatus(cb.name, 'No detector configured.', 'muted');
              clearProviderActions(cb.name);
            }
          });
          const found = (msg.detection || []).filter(function (d) { return d.installed; }).length;
          status.textContent = 'Scan complete. ' + found + ' CLI(s) found.';
          status.className = 'status ok';
          return;
        }

        if (msg.type === 'settings.saved') {
          status.textContent = 'Settings saved.';
          status.className = 'status ok';
        } else if (msg.type === 'settings.error') {
          status.textContent = 'Error: ' + msg.message;
          status.className = 'status err';
        }
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
