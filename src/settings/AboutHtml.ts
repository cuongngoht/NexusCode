import * as vscode from 'vscode';
import * as crypto from 'crypto';

export function getAboutHtml(webview: vscode.Webview): string {
  const nonce = crypto.randomBytes(16).toString('hex');

  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>About Nexus Code</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 32px 36px;
      margin: 0;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 8px;
    }
    .logo {
      font-size: 2em;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--vscode-foreground);
      line-height: 1;
    }
    .version {
      font-size: 0.78em;
      padding: 2px 8px;
      border-radius: 20px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-weight: 500;
      align-self: center;
    }
    .desc {
      color: var(--vscode-descriptionForeground);
      font-size: 0.88em;
      margin: 0 0 28px;
      line-height: 1.5;
    }
    hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 20px 0;
    }
    h2 {
      font-size: 0.78em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 12px;
    }
    .author-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }
    .author-name {
      font-weight: 600;
      font-size: 0.95em;
    }
    .author-github {
      font-size: 0.82em;
      color: var(--vscode-textLink-foreground);
    }
    .oss-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .oss-item {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .oss-name {
      font-weight: 500;
      font-size: 0.9em;
      min-width: 200px;
    }
    .oss-license {
      font-size: 0.75em;
      padding: 1px 6px;
      border-radius: 3px;
      background: var(--vscode-textCodeBlock-background);
      color: var(--vscode-descriptionForeground);
    }
    .oss-desc {
      font-size: 0.82em;
      color: var(--vscode-descriptionForeground);
    }
    .sponsor-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sponsor-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sponsor-name {
      font-weight: 600;
      font-size: 0.92em;
    }
    .sponsor-badge {
      font-size: 0.75em;
      padding: 1px 7px;
      border-radius: 20px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-weight: 500;
    }
    .sponsor-desc {
      font-size: 0.82em;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="logo">NEXUS</span>
    <span class="version">v0.1.3</span>
  </div>
  <p class="desc">A chat cockpit that routes prompts to installed CLI coding agents.</p>

  <hr />

  <h2>Author</h2>
  <div class="author-row">
    <span class="author-name">Ngô Hoàng Tuấn Cường</span>
    <span class="author-github">github.com/cuongngoht</span>
  </div>

  <hr />

  <h2>Nhà tài trợ</h2>
  <ul class="sponsor-list">
    <li class="sponsor-item">
      <span class="sponsor-name">Khám Phá Mới</span>
      <span class="sponsor-badge">Sponsor</span>
      <span class="sponsor-desc">Đồng hành và hỗ trợ phát triển dự án</span>
    </li>
  </ul>

  <hr />

  <h2>Open Source</h2>
  <ul class="oss-list">
    <li class="oss-item">
      <span class="oss-name">React 19</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">UI component library</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">Fluent UI React v9</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">Microsoft design system</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">VS Code Extension API</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">Extension platform by Microsoft</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">Commander</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">CLI framework</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">Zod</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">Schema validation</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">Vite</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">Frontend build tool</span>
    </li>
  </ul>

  <script nonce="${nonce}">void 0;</script>
</body>
</html>`;
}
