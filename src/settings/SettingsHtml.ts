import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { NexusConfig } from '../config/NexusConfig';

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini CLI',
  codex: 'Codex CLI',
  claude: 'Claude CLI',
  copilot: 'Copilot CLI',
  aider: 'Aider',
};

export function getSettingsHtml(
  webview: vscode.Webview,
  config: NexusConfig,
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
        <div class="provider-row">
          <label>
            <input type="checkbox" name="${id}" ${checked} />
            <span class="provider-name">${escapeHtml(label)}</span>
          </label>
          <div class="provider-command">Command: <code>${escapeHtml(p.command)}</code></div>
        </div>`;
    })
    .join('\n');

  // Embed JSON safely in inline script — escape </script> to prevent early tag close
  const safeJson = JSON.stringify(config).replace(/<\/script>/gi, '<\\/script>');

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
      margin: 0 0 16px;
    }
    .provider-row {
      margin-bottom: 14px;
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
  <h2>CLI Providers</h2>
  <p class="section-desc">Choose which local CLI tools Nexus can use.</p>

  <div id="providers">${rows}</div>

  <button class="save-btn" id="saveBtn">Save Settings</button>
  <div class="status" id="status"></div>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const base = ${safeJson};

      document.getElementById('saveBtn').addEventListener('click', function () {
        const checkboxes = document.querySelectorAll('#providers input[type=checkbox]');
        const providers = Object.assign({}, base.providers);
        checkboxes.forEach(function (cb) {
          const id = cb.name;
          if (providers[id]) {
            providers[id] = Object.assign({}, providers[id], { enabled: cb.checked });
          }
        });
        const config = Object.assign({}, base, { providers: providers });
        vscode.postMessage({ type: 'settings.save', payload: config });
      });

      window.addEventListener('message', function (event) {
        const msg = event.data;
        const status = document.getElementById('status');
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
