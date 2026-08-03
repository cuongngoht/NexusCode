import { MCP_NAME_PATTERN, SECRET_SENTINEL } from './McpServerModel';

/**
 * The "Custom MCP Servers" block of the Settings panel: an Add button, a list of
 * saved servers with Test/Edit/Delete, and one form reused for both add and edit.
 *
 * Split out of SettingsHtml.ts to keep that file manageable. Exported as three
 * strings that SettingsHtml splices into its own template literal.
 *
 * The form markup is static because this webview has no innerHTML and no
 * framework — only the genuinely dynamic parts (server rows, header/env rows)
 * are built with createElement, mirroring addProviderButton in SettingsHtml.ts.
 */

/** Markup for the section. Takes no arguments — the list is rendered client-side. */
export function renderMcpServersSectionHtml(): string {
  return /* html */ `
    <h3>Custom MCP Servers</h3>
    <p class="description">
      Connect your own MCP servers — same entry shape as Claude Code's <code>.mcp.json</code>.
      Custom servers are treated as <strong>high risk</strong>, so every tool call asks for your
      approval unless you lower Risk under Advanced.
    </p>

    <div class="setting-actions" style="margin-top: 4px">
      <button type="button" id="mcp-add-server">+ Add MCP Server</button>
    </div>

    <div id="mcp-servers-list"></div>

    <div class="mcp-form" id="mcp-server-form" hidden>
      <div class="mcp-form-title" id="mcp-form-title">Add MCP Server</div>

      <div class="setting-row">
        <label for="mcp-f-name">Name</label>
        <input class="mcp-text" type="text" id="mcp-f-name" spellcheck="false"
               placeholder="portaltalk-docs" aria-describedby="mcp-e-name" />
        <span class="setting-hint">Server id, and the keywords used to auto-pick it.</span>
      </div>
      <p class="field-error" id="mcp-e-name" hidden></p>

      <div class="setting-row">
        <label for="mcp-f-type">Type</label>
        <select id="mcp-f-type">
          <option value="http">HTTP — remote server</option>
          <option value="stdio">stdio — local process</option>
        </select>
      </div>

      <div id="mcp-http-fields" role="group" aria-label="HTTP settings">
        <div class="setting-row">
          <label for="mcp-f-url">URL</label>
          <input class="mcp-text" type="text" id="mcp-f-url" spellcheck="false"
                 placeholder="https://example.com/mcp" aria-describedby="mcp-e-url" />
        </div>
        <p class="field-error" id="mcp-e-url" hidden></p>

        <div class="setting-row">
          <span id="mcp-headers-label">Headers</span>
          <span class="setting-hint">For auth, e.g. <code>Authorization</code> / <code>Bearer …</code>. Values stay hidden.</span>
        </div>
        <div id="mcp-headers" role="group" aria-labelledby="mcp-headers-label"></div>
        <div class="setting-actions" style="margin-top: 4px">
          <button type="button" data-mcp-action="add-header">+ Add header</button>
        </div>
        <p class="field-error" id="mcp-e-headers" hidden></p>
      </div>

      <div id="mcp-stdio-fields" role="group" aria-label="stdio settings" hidden>
        <div class="setting-row">
          <label for="mcp-f-command">Command</label>
          <input class="mcp-text" type="text" id="mcp-f-command" spellcheck="false"
                 placeholder="npx" aria-describedby="mcp-e-command" />
        </div>
        <p class="field-error" id="mcp-e-command" hidden></p>

        <div class="setting-row">
          <label for="mcp-f-args">Arguments</label>
          <span class="setting-hint">One argument per line.</span>
        </div>
        <textarea class="mcp-text" id="mcp-f-args" rows="3" spellcheck="false"></textarea>

        <div class="setting-row">
          <span id="mcp-env-label">Environment</span>
          <span class="setting-hint">Passed to the process. Values stay hidden.</span>
        </div>
        <div id="mcp-env" role="group" aria-labelledby="mcp-env-label"></div>
        <div class="setting-actions" style="margin-top: 4px">
          <button type="button" data-mcp-action="add-env">+ Add variable</button>
        </div>
        <p class="field-error" id="mcp-e-env" hidden></p>
      </div>

      <details class="mcp-advanced">
        <summary>Advanced</summary>
        <div class="setting-row">
          <label class="setting-label">
            <input type="checkbox" id="mcp-f-enabled" checked />
            <span>Enabled</span>
          </label>
        </div>
        <div class="setting-row">
          <label for="mcp-f-risk">Risk</label>
          <select id="mcp-f-risk">
            <option value="high">High — approve every call (recommended)</option>
            <option value="medium">Medium — approve every call</option>
            <option value="low">Low — no approval prompt</option>
          </select>
          <span class="setting-hint">Lower this only for servers you fully trust.</span>
        </div>
        <div class="setting-row">
          <label for="mcp-f-defaultTool">Default tool</label>
          <input class="mcp-text" type="text" id="mcp-f-defaultTool" spellcheck="false"
                 placeholder="(auto-discover)" />
          <span class="setting-hint">Skip tool discovery and always call this tool.</span>
        </div>
        <div class="setting-row">
          <label for="mcp-f-bestFor">Best for</label>
          <input class="mcp-text" type="text" id="mcp-f-bestFor" spellcheck="false"
                 placeholder="(derived from the name)" />
          <span class="setting-hint">Comma-separated keywords that make Nexus pick this server.</span>
        </div>
      </details>

      <div class="setting-actions">
        <button type="button" id="mcp-form-commit">Add Server</button>
        <button type="button" id="mcp-form-test">Test Connection</button>
        <button type="button" id="mcp-form-cancel">Cancel</button>
      </div>
      <div class="provider-status muted" id="mcp-form-status" role="status" aria-live="polite"></div>
    </div>

    <p class="description">
      Servers are kept in <code>.nexus/config.json</code> — any field not shown here can still be
      edited there by hand, and is preserved when you edit a server from this panel.
    </p>`;
}

/** Rules appended inside the existing <style> block. */
export const MCP_SERVERS_CSS = /* css */ `
    .mcp-form {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px 14px;
      margin: 12px 0;
    }
    .mcp-form-title {
      font-weight: 600;
      margin-bottom: 10px;
    }
    .mcp-text {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 3px 6px;
      font-size: 0.9em;
      font-family: var(--vscode-font-family);
      min-width: 280px;
    }
    textarea.mcp-text {
      width: 100%;
      box-sizing: border-box;
      font-family: var(--vscode-editor-font-family, monospace);
      margin-bottom: 8px;
    }
    .mcp-kv-row {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }
    .mcp-kv-row .mcp-text {
      min-width: 150px;
      flex: 1 1 150px;
    }
    .mcp-advanced {
      margin: 12px 0 4px;
    }
    .mcp-advanced summary {
      cursor: pointer;
      font-size: 0.9em;
      font-weight: 600;
    }
    .field-error {
      color: var(--vscode-errorForeground);
      font-size: 0.8em;
      margin: 0 0 8px;
    }
    .mcp-badge {
      font-size: 0.75em;
      padding: 1px 6px;
      margin-left: 8px;
      border-radius: 8px;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
    }
    .mcp-server-row.disabled .provider-name {
      opacity: 0.7;
    }`;

/**
 * Client-side logic, concatenated INSIDE the existing IIFE in SettingsHtml.ts so
 * it closes over `vscode` and `base`. Written with quote concatenation (no
 * template literals) to match the surrounding inline script.
 */
export const MCP_SERVERS_CLIENT_SCRIPT = /* js */ `
      // ---------------- Custom MCP servers ----------------
      var MCP_SENTINEL = '${SECRET_SENTINEL}';
      var MCP_NAME_RE = ${MCP_NAME_PATTERN.toString()};
      var MCP_MASK_PLACEHOLDER = '\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022 (unchanged)';

      // Array, not an object: display order stays stable and a rename mutates in
      // place instead of reordering the on-disk JSON. cfg keeps the original
      // object so fields this form does not expose survive an edit. origName is
      // never touched by a rename — it is the key for secret rehydration.
      var mcpServers = Object.keys((base.mcp && base.mcp.customServers) || {}).map(function (name) {
        return { name: name, origName: name, cfg: base.mcp.customServers[name] || {} };
      });
      var mcpEditingIndex = -1;
      var mcpPendingDelete = null;
      var mcpTestSeq = 0;
      var mcpTestTargets = {};

      function mcpEl(id) { return document.getElementById(id); }

      function mcpIsHttpUrl(url) {
        try {
          var parsed = new URL(url);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (e) { return false; }
      }

      function mcpPlural(count, noun) { return count + ' ' + noun + (count === 1 ? '' : 's'); }

      function mcpSetOrDelete(target, key, value) {
        var empty = value === '' || value === undefined ||
          (Array.isArray(value) && value.length === 0) ||
          (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
        if (empty) { delete target[key]; } else { target[key] = value; }
      }

      // KEEP IN SYNC WITH summarizeServer() in src/settings/McpServerModel.ts
      function mcpSummarize(cfg) {
        var parts = [];
        var problem;
        if (cfg.type === 'stdio') {
          parts.push('stdio');
          var command = [cfg.command || ''].concat(cfg.args || []).join(' ').trim();
          if (command) { parts.push(command); }
          var envCount = Object.keys(cfg.env || {}).length;
          if (envCount) { parts.push(mcpPlural(envCount, 'env var')); }
          if (!(cfg.command || '').trim()) {
            problem = 'Incomplete: a stdio server needs a command. This server is ignored until you fix it.';
          }
        } else if (cfg.type === 'http') {
          parts.push('HTTP');
          if (cfg.url) { parts.push(cfg.url); }
          var headerCount = Object.keys(cfg.headers || {}).length;
          if (headerCount) { parts.push(mcpPlural(headerCount, 'header')); }
          if (!mcpIsHttpUrl(cfg.url || '')) {
            problem = 'Incomplete: an HTTP server needs a valid http:// or https:// URL. This server is ignored until you fix it.';
          }
        } else {
          return {
            line: 'Unknown type "' + String(cfg.type || '') + '"',
            problem: 'Unsupported type - use "http" or "stdio". This server is ignored until you fix it.'
          };
        }
        if (cfg.risk && cfg.risk !== 'high') { parts.push('risk: ' + cfg.risk); }
        return { line: parts.join(' \\u00b7 '), problem: problem };
      }

      // KEEP IN SYNC WITH validateMcpServerDraft() in src/settings/McpServerModel.ts
      function mcpValidate(draft, existingNames, editingName) {
        var errors = {};
        var name = draft.name.trim();
        if (!name) {
          errors.name = 'Name is required.';
        } else if (!MCP_NAME_RE.test(name)) {
          errors.name = 'Use only letters, numbers, dot, dash or underscore.';
        } else {
          var editing = editingName ? editingName.trim().toLowerCase() : undefined;
          var taken = existingNames.some(function (existing) {
            var other = existing.trim().toLowerCase();
            return other === name.toLowerCase() && other !== editing;
          });
          if (taken) { errors.name = 'A server named "' + name + '" already exists.'; }
        }

        if (draft.type === 'http') {
          if (!mcpIsHttpUrl(draft.url.trim())) { errors.url = 'Enter a valid http:// or https:// URL.'; }
          if (mcpHasOrphanValue(draft.headers)) { errors.headers = 'Every header needs a name.'; }
        } else {
          if (!draft.command.trim()) { errors.command = 'Command is required for stdio servers.'; }
          if (mcpHasOrphanValue(draft.env)) { errors.env = 'Every environment variable needs a name.'; }
        }
        return errors;
      }

      function mcpHasOrphanValue(rows) {
        return rows.some(function (row) {
          return !row.key.trim() && (row.value.trim() !== '' || row.keep === true);
        });
      }

      function mcpRowsToRecord(rows) {
        var out = {};
        rows.forEach(function (row) {
          var key = row.key.trim();
          if (!key) { return; }
          // An untouched masked row goes back as the sentinel so the extension
          // host restores the real value from disk.
          out[key] = (row.keep === true && row.value === '') ? MCP_SENTINEL : row.value;
        });
        return out;
      }

      function mcpDraftToCfg(draft, existing) {
        var next = Object.assign({}, existing || {});
        next.type = draft.type;
        next.enabled = draft.enabled;
        next.risk = draft.risk;
        if (draft.type === 'http') {
          next.url = draft.url.trim();
          mcpSetOrDelete(next, 'headers', mcpRowsToRecord(draft.headers));
          delete next.command; delete next.args; delete next.env;
        } else {
          next.command = draft.command.trim();
          mcpSetOrDelete(next, 'args', draft.args.map(function (a) { return a.trim(); }).filter(Boolean));
          mcpSetOrDelete(next, 'env', mcpRowsToRecord(draft.env));
          delete next.url; delete next.headers;
        }
        mcpSetOrDelete(next, 'defaultTool', draft.defaultTool.trim());
        mcpSetOrDelete(next, 'bestFor', draft.bestFor.map(function (k) { return k.trim(); }).filter(Boolean));
        return next;
      }

      // ---- list rendering ----

      function mcpRenderList() {
        var host = mcpEl('mcp-servers-list');
        host.textContent = '';

        if (!mcpServers.length) {
          var empty = document.createElement('div');
          empty.className = 'provider-status muted';
          empty.textContent = 'No custom MCP servers yet. Click "+ Add MCP Server" to connect one.';
          host.appendChild(empty);
          return;
        }
        mcpServers.forEach(function (entry, index) { host.appendChild(mcpBuildRow(entry, index)); });
      }

      function mcpBuildRow(entry, index) {
        var summary = mcpSummarize(entry.cfg);
        var disabled = entry.cfg.enabled === false;

        var row = document.createElement('div');
        row.className = 'provider-row mcp-server-row' + (disabled ? ' disabled' : '');
        row.dataset.mcpName = entry.name;

        var main = document.createElement('div');
        main.className = 'provider-main';

        var nameWrap = document.createElement('div');
        var nameEl = document.createElement('span');
        nameEl.className = 'provider-name';
        nameEl.textContent = entry.name;
        nameWrap.appendChild(nameEl);
        if (disabled) {
          var badge = document.createElement('span');
          badge.className = 'mcp-badge';
          badge.textContent = 'Disabled';
          nameWrap.appendChild(badge);
        }
        main.appendChild(nameWrap);

        var actions = document.createElement('div');
        actions.className = 'provider-actions';
        [
          { action: 'test', label: 'Test' },
          { action: 'edit', label: 'Edit' },
          { action: 'delete', label: mcpPendingDelete === entry.name ? 'Confirm delete?' : 'Delete' }
        ].forEach(function (spec) {
          var btn = document.createElement('button');
          btn.className = 'provider-action-btn';
          btn.type = 'button';
          btn.dataset.mcpAction = spec.action;
          btn.dataset.mcpName = entry.name;
          btn.dataset.mcpIndex = String(index);
          btn.textContent = spec.label;
          actions.appendChild(btn);
        });
        main.appendChild(actions);
        row.appendChild(main);

        var detail = document.createElement('div');
        detail.className = 'provider-command';
        detail.textContent = summary.line;
        row.appendChild(detail);

        var status = document.createElement('div');
        status.className = 'provider-status ' + (summary.problem ? 'err' : 'muted');
        status.dataset.mcpStatus = entry.name;
        status.textContent = summary.problem || '';
        row.appendChild(status);

        return row;
      }

      function mcpSetRowStatus(name, text, className) {
        var el = document.querySelector('[data-mcp-status="' + name + '"]');
        if (!el) { return; }
        el.textContent = text;
        el.className = 'provider-status ' + className;
      }

      function mcpSetFormStatus(text, className) {
        var el = mcpEl('mcp-form-status');
        el.textContent = text;
        el.className = 'provider-status ' + (className || 'muted');
      }

      function mcpSetPanelStatus(text, className) {
        var el = mcpEl('status');
        el.textContent = text;
        el.className = 'status ' + className;
      }

      // ---- key/value editors ----

      function mcpAddKvRow(container, key, value, keep, kind) {
        var row = document.createElement('div');
        row.className = 'mcp-kv-row';

        var keyInput = document.createElement('input');
        keyInput.className = 'mcp-text mcp-kv-key';
        keyInput.type = 'text';
        keyInput.spellcheck = false;
        keyInput.value = key || '';
        keyInput.placeholder = kind === 'env' ? 'VARIABLE' : 'Authorization';
        keyInput.setAttribute('aria-label', kind === 'env' ? 'Variable name' : 'Header name');
        row.appendChild(keyInput);

        var valueInput = document.createElement('input');
        valueInput.className = 'mcp-text mcp-kv-value';
        valueInput.type = 'password';
        valueInput.spellcheck = false;
        valueInput.value = keep ? '' : (value || '');
        valueInput.placeholder = keep ? MCP_MASK_PLACEHOLDER : 'Bearer ...';
        valueInput.setAttribute('aria-label', kind === 'env' ? 'Variable value' : 'Header value');
        if (keep) { valueInput.dataset.mcpKeep = '1'; }
        // Typing means replacing — drop the keep-existing marker.
        valueInput.addEventListener('input', function () {
          delete valueInput.dataset.mcpKeep;
          valueInput.placeholder = 'Bearer ...';
        });
        row.appendChild(valueInput);

        var toggle = document.createElement('button');
        toggle.className = 'provider-action-btn';
        toggle.type = 'button';
        toggle.dataset.mcpAction = 'toggle-secret';
        toggle.setAttribute('aria-pressed', 'false');
        toggle.textContent = 'Show';
        row.appendChild(toggle);

        var remove = document.createElement('button');
        remove.className = 'provider-action-btn';
        remove.type = 'button';
        remove.dataset.mcpAction = 'remove-kv';
        remove.setAttribute('aria-label', kind === 'env' ? 'Remove variable' : 'Remove header');
        remove.textContent = 'Remove';
        row.appendChild(remove);

        container.appendChild(row);
        return row;
      }

      function mcpReadKvRows(container) {
        return Array.prototype.map.call(container.querySelectorAll('.mcp-kv-row'), function (row) {
          var valueInput = row.querySelector('.mcp-kv-value');
          return {
            key: row.querySelector('.mcp-kv-key').value,
            value: valueInput.value,
            keep: valueInput.dataset.mcpKeep === '1'
          };
        });
      }

      function mcpFillKvRows(container, record, kind) {
        container.textContent = '';
        var keys = Object.keys(record || {});
        keys.forEach(function (key) {
          var value = record[key];
          mcpAddKvRow(container, key, value === MCP_SENTINEL ? '' : value, value === MCP_SENTINEL, kind);
        });
        if (!keys.length) { mcpAddKvRow(container, '', '', false, kind); }
      }

      // ---- form ----

      function mcpSyncTypeFields() {
        var isHttp = mcpEl('mcp-f-type').value === 'http';
        mcpEl('mcp-http-fields').hidden = !isHttp;
        mcpEl('mcp-stdio-fields').hidden = isHttp;
      }

      function mcpReadDraft() {
        return {
          name: mcpEl('mcp-f-name').value,
          type: mcpEl('mcp-f-type').value === 'stdio' ? 'stdio' : 'http',
          url: mcpEl('mcp-f-url').value,
          headers: mcpReadKvRows(mcpEl('mcp-headers')),
          command: mcpEl('mcp-f-command').value,
          args: mcpEl('mcp-f-args').value.split('\\n').map(function (a) { return a.trim(); }).filter(Boolean),
          env: mcpReadKvRows(mcpEl('mcp-env')),
          enabled: mcpEl('mcp-f-enabled').checked,
          risk: mcpEl('mcp-f-risk').value,
          defaultTool: mcpEl('mcp-f-defaultTool').value,
          bestFor: mcpEl('mcp-f-bestFor').value.split(',').map(function (k) { return k.trim(); }).filter(Boolean)
        };
      }

      function mcpShowErrors(errors) {
        ['name', 'url', 'command', 'headers', 'env'].forEach(function (field) {
          var el = mcpEl('mcp-e-' + field);
          var message = errors[field];
          el.textContent = message || '';
          el.hidden = !message;
          var input = mcpEl('mcp-f-' + field);
          if (input) {
            if (message) { input.setAttribute('aria-invalid', 'true'); }
            else { input.removeAttribute('aria-invalid'); }
          }
        });
        var first = ['name', 'url', 'command', 'headers', 'env'].filter(function (f) { return errors[f]; })[0];
        if (first) {
          var target = mcpEl('mcp-f-' + first);
          if (target) { target.focus(); }
        }
      }

      function mcpOpenForm(index) {
        mcpEditingIndex = index;
        mcpPendingDelete = null;
        var entry = index >= 0 ? mcpServers[index] : null;
        var cfg = entry ? entry.cfg : {};

        mcpEl('mcp-f-name').value = entry ? entry.name : '';
        mcpEl('mcp-f-type').value = cfg.type === 'stdio' ? 'stdio' : 'http';
        mcpEl('mcp-f-url').value = cfg.url || '';
        mcpEl('mcp-f-command').value = cfg.command || '';
        mcpEl('mcp-f-args').value = (cfg.args || []).join('\\n');
        mcpEl('mcp-f-enabled').checked = cfg.enabled !== false;
        mcpEl('mcp-f-risk').value = cfg.risk || 'high';
        mcpEl('mcp-f-defaultTool').value = cfg.defaultTool || '';
        mcpEl('mcp-f-bestFor').value = (cfg.bestFor || []).join(', ');
        mcpFillKvRows(mcpEl('mcp-headers'), cfg.headers, 'header');
        mcpFillKvRows(mcpEl('mcp-env'), cfg.env, 'env');

        mcpEl('mcp-form-title').textContent = entry ? 'Edit MCP Server' : 'Add MCP Server';
        mcpEl('mcp-form-commit').textContent = entry ? 'Save Server' : 'Add Server';
        mcpShowErrors({});
        mcpSetFormStatus('', 'muted');
        mcpSyncTypeFields();

        mcpEl('mcp-server-form').hidden = false;
        mcpEl('mcp-add-server').hidden = true;
        mcpRenderList();
        mcpEl('mcp-server-form').scrollIntoView({ block: 'nearest' });
        mcpEl('mcp-f-name').focus();
      }

      function mcpCloseForm() {
        mcpEditingIndex = -1;
        mcpEl('mcp-server-form').hidden = true;
        mcpEl('mcp-add-server').hidden = false;
        mcpShowErrors({});
        mcpSetFormStatus('', 'muted');
      }

      function mcpOtherNames() {
        return mcpServers.filter(function (_, i) { return i !== mcpEditingIndex; })
          .map(function (entry) { return entry.name; });
      }

      /** Returns false when the draft is invalid, so callers can abort a save. */
      function mcpCommitDraft() {
        var draft = mcpReadDraft();
        var editing = mcpEditingIndex >= 0 ? mcpServers[mcpEditingIndex] : null;
        var errors = mcpValidate(draft, mcpOtherNames(), editing ? editing.name : undefined);
        if (Object.keys(errors).length) { mcpShowErrors(errors); return false; }

        var name = draft.name.trim();
        var cfg = mcpDraftToCfg(draft, editing ? editing.cfg : undefined);
        if (editing) {
          editing.name = name;
          editing.cfg = cfg;
        } else {
          mcpServers.push({ name: name, origName: name, cfg: cfg });
        }

        mcpCloseForm();
        mcpRenderList();
        mcpSetPanelStatus('Custom MCP server updated in this panel - click "Save Settings" to apply.', 'ok');
        mcpEl('mcp-add-server').focus();
        return true;
      }

      // ---- test connection ----

      function mcpRequestTest(name, cfg, origName, target) {
        var requestId = 'mcp-' + (++mcpTestSeq);
        mcpTestTargets[requestId] = { name: name, target: target };
        if (target === 'form') { mcpSetFormStatus('Testing connection...', 'muted'); }
        else { mcpSetRowStatus(name, 'Testing connection...', 'muted'); }
        vscode.postMessage({
          type: 'settings.testMcpServer',
          requestId: requestId,
          name: name,
          origName: origName,
          server: cfg
        });
        // Watchdog: never leave the row stuck on "Testing..." if no reply arrives.
        setTimeout(function () {
          if (!mcpTestTargets[requestId]) { return; }
          delete mcpTestTargets[requestId];
          var message = 'No response from the extension host. Try again.';
          if (target === 'form') { mcpSetFormStatus(message, 'err'); }
          else { mcpSetRowStatus(name, message, 'err'); }
        }, 15000);
      }

      function mcpHandleTestResult(msg) {
        var pending = mcpTestTargets[msg.requestId];
        if (!pending) { return; }
        delete mcpTestTargets[msg.requestId];

        var text;
        if (msg.ok) {
          text = 'Connected. ' + mcpPlural(msg.toolCount || 0, 'tool');
          if (msg.tools && msg.tools.length) { text += ': ' + msg.tools.join(', ') + '.'; }
        } else if (msg.code === 'timeout') {
          text = 'Timed out - check the URL, the network, or the auth header.';
        } else {
          text = msg.error || 'Connection failed.';
        }

        if (pending.target === 'form') { mcpSetFormStatus(text, msg.ok ? 'ok' : 'err'); }
        else { mcpSetRowStatus(pending.name, text, msg.ok ? 'ok' : 'err'); }
      }

      // ---- wiring ----

      mcpEl('mcp-add-server').addEventListener('click', function () { mcpOpenForm(-1); });
      mcpEl('mcp-f-type').addEventListener('change', mcpSyncTypeFields);
      mcpEl('mcp-form-commit').addEventListener('click', function () { mcpCommitDraft(); });
      mcpEl('mcp-form-cancel').addEventListener('click', function () { mcpCloseForm(); });

      mcpEl('mcp-form-test').addEventListener('click', function () {
        var draft = mcpReadDraft();
        var editing = mcpEditingIndex >= 0 ? mcpServers[mcpEditingIndex] : null;
        var errors = mcpValidate(draft, mcpOtherNames(), editing ? editing.name : undefined);
        if (Object.keys(errors).length) { mcpShowErrors(errors); return; }
        mcpRequestTest(
          draft.name.trim(),
          mcpDraftToCfg(draft, editing ? editing.cfg : undefined),
          editing ? editing.origName : undefined,
          'form'
        );
      });

      mcpEl('mcp-servers-list').addEventListener('click', function (event) {
        var btn = event.target.closest ? event.target.closest('button[data-mcp-action]') : null;
        if (!btn) { return; }
        var index = parseInt(btn.dataset.mcpIndex, 10);
        var entry = mcpServers[index];
        if (!entry) { return; }

        if (btn.dataset.mcpAction === 'edit') {
          mcpOpenForm(index);
        } else if (btn.dataset.mcpAction === 'test') {
          mcpRequestTest(entry.name, entry.cfg, entry.origName, 'row');
        } else if (btn.dataset.mcpAction === 'delete') {
          // Two-step confirm: VS Code suppresses window.confirm inside webviews.
          if (mcpPendingDelete === entry.name) {
            mcpServers.splice(index, 1);
            mcpPendingDelete = null;
            if (mcpEditingIndex === index) { mcpCloseForm(); }
            mcpRenderList();
            mcpSetPanelStatus('Custom MCP server removed in this panel - click "Save Settings" to apply.', 'ok');
          } else {
            mcpPendingDelete = entry.name;
            mcpRenderList();
          }
        }
      });

      mcpEl('mcp-server-form').addEventListener('click', function (event) {
        var btn = event.target.closest ? event.target.closest('button[data-mcp-action]') : null;
        if (!btn) { return; }
        var action = btn.dataset.mcpAction;

        if (action === 'add-header') {
          mcpAddKvRow(mcpEl('mcp-headers'), '', '', false, 'header').querySelector('.mcp-kv-key').focus();
        } else if (action === 'add-env') {
          mcpAddKvRow(mcpEl('mcp-env'), '', '', false, 'env').querySelector('.mcp-kv-key').focus();
        } else if (action === 'remove-kv') {
          btn.parentNode.remove();
        } else if (action === 'toggle-secret') {
          var input = btn.parentNode.querySelector('.mcp-kv-value');
          var reveal = input.type === 'password';
          input.type = reveal ? 'text' : 'password';
          btn.textContent = reveal ? 'Hide' : 'Show';
          btn.setAttribute('aria-pressed', reveal ? 'true' : 'false');
        }
      });

      mcpEl('mcp-server-form').addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { mcpCloseForm(); return; }
        if (event.key !== 'Enter') { return; }
        if (event.target && event.target.tagName === 'TEXTAREA') { return; }
        event.preventDefault();
        mcpCommitDraft();
      });

      mcpRenderList();`;
