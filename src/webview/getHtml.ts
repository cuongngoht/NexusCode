import * as vscode from 'vscode';
import * as crypto from 'crypto';

export function getHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const nonce = crypto.randomBytes(16).toString('hex');

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'main.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'style.css'),
  );

  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" nonce="${nonce}" />
  <title>Nexus Chat</title>
</head>
<body>
  <div id="root">
    <header class="toolbar">
      <div class="toolbar-row">
        <label for="provider-select">Provider</label>
        <select id="provider-select">
          <option value="auto">auto</option>
          <option value="claude">claude</option>
          <option value="codex">codex</option>
          <option value="gemini">gemini</option>
          <option value="copilot">copilot</option>
          <option value="aider">aider</option>
          <option value="custom">custom</option>
        </select>
        <label for="mode-select">Mode</label>
        <select id="mode-select">
          <option value="edit">edit</option>
          <option value="debug">debug</option>
          <option value="test">test</option>
          <option value="refactor">refactor</option>
          <option value="research">research</option>
          <option value="ask">ask</option>
        </select>
      </div>
    </header>

    <div id="messages" class="messages" aria-live="polite" aria-label="Task output"></div>

    <div id="timeline" class="timeline hidden">
      <span id="timeline-label">Elapsed: <span id="elapsed">0s</span></span>
    </div>

    <section id="git-status-section" class="git-status hidden">
      <h3>Changed Files</h3>
      <ul id="changed-files"></ul>
      <button id="btn-scm" class="btn btn-secondary">Open Source Control</button>
    </section>

    <details id="raw-output-section" class="raw-output hidden">
      <summary>Raw output</summary>
      <pre id="raw-output"></pre>
    </details>

    <footer class="input-area">
      <textarea
        id="prompt-input"
        rows="4"
        placeholder="Type your prompt here…"
        aria-label="Prompt input"
      ></textarea>
      <div class="button-row">
        <button id="btn-run" class="btn btn-primary">Run</button>
        <button id="btn-stop" class="btn btn-danger" disabled>Stop</button>
      </div>
    </footer>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
