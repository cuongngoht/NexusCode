import * as vscode from 'vscode';
import * as crypto from 'crypto';

type Locale = 'vi' | 'en';

const STRINGS = {
  vi: {
    title: 'Giới thiệu Nexus AI Code',
    desc: 'Giao diện chat mã nguồn mở, định tuyến prompt đến các CLI coding agent đã cài.',
    repoLabel: 'Mã nguồn trên GitHub',
    sectionAuthor: 'Tác giả',
    sectionSponsors: 'Nhà tài trợ',
    sponsorBadge: 'Nhà tài trợ',
    sponsorKhamPhaDesc: 'Đồng hành và hỗ trợ phát triển dự án',
    sectionOss: 'Mã nguồn mở',
    ossRuntime: 'runtime',
    ossDevDependency: 'dev',
  },
  en: {
    title: 'About Nexus AI Code',
    desc: 'An open-source chat cockpit that routes prompts to installed CLI coding agents.',
    repoLabel: 'View source on GitHub',
    sectionAuthor: 'Author',
    sectionSponsors: 'Sponsors',
    sponsorBadge: 'Sponsor',
    sponsorKhamPhaDesc: 'Supporting project development',
    sectionOss: 'Open Source',
    ossRuntime: 'runtime',
    ossDevDependency: 'dev',
  },
} satisfies Record<Locale, Record<string, string>>;

type PackageKind = 'runtime' | 'dev';

const OSS_PACKAGES: Array<{ name: string; kind: PackageKind }> = [
  { name: '@fluentui/react-components', kind: 'runtime' },
  { name: '@fluentui/react-icons', kind: 'runtime' },
  { name: '@modelcontextprotocol/sdk', kind: 'runtime' },
  { name: 'commander', kind: 'runtime' },
  { name: 'gpt-tokenizer', kind: 'runtime' },
  { name: 'mermaid', kind: 'runtime' },
  { name: 'react', kind: 'runtime' },
  { name: 'react-dom', kind: 'runtime' },
  { name: 'react-markdown', kind: 'runtime' },
  { name: 'rehype-highlight', kind: 'runtime' },
  { name: 'rehype-sanitize', kind: 'runtime' },
  { name: 'remark-gfm', kind: 'runtime' },
  { name: 'zod', kind: 'runtime' },
  { name: '@testing-library/react', kind: 'dev' },
  { name: '@types/node', kind: 'dev' },
  { name: '@types/react', kind: 'dev' },
  { name: '@types/react-dom', kind: 'dev' },
  { name: '@types/vscode', kind: 'dev' },
  { name: '@vitejs/plugin-react', kind: 'dev' },
  { name: 'esbuild', kind: 'dev' },
  { name: 'jsdom', kind: 'dev' },
  { name: 'typescript', kind: 'dev' },
  { name: 'vite', kind: 'dev' },
  { name: 'vitest', kind: 'dev' },
];

function resolveLocale(): Locale {
  return vscode.env.language.startsWith('vi') ? 'vi' : 'en';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getAboutHtml(webview: vscode.Webview): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const s = STRINGS[resolveLocale()];
  const projectLicenseItem = /* html */`
      <li class="oss-item oss-item-first">
        <div class="oss-left">
          <span class="oss-name">Nexus AI Code</span>
          <a class="github-link" href="https://github.com/cuongngoht/NexusCode" target="_blank" rel="noopener">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            github.com/cuongngoht/NexusCode
          </a>
        </div>
        <span class="oss-license">MIT</span>
      </li>`;
  const packageItems = OSS_PACKAGES
    .map((pkg) => {
      const label = pkg.kind === 'runtime' ? s.ossRuntime : s.ossDevDependency;
      return /* html */`
      <li class="oss-item">
        <div class="oss-left">
          <span class="oss-name">${escapeHtml(pkg.name)}</span>
        </div>
        <span class="oss-license">${escapeHtml(label)}</span>
      </li>`;
    })
    .join('');
  const ossItems = projectLicenseItem + packageItems;

  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return /* html */`<!DOCTYPE html>
<html lang="${resolveLocale()}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 28px 28px 40px;
      margin: 0;
      max-width: 560px;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .logo {
      font-size: 1.5em;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--vscode-foreground);
      line-height: 1;
    }
    .version {
      font-size: 0.72em;
      padding: 2px 8px;
      border-radius: 20px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .desc {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
      margin: 0 0 24px;
      line-height: 1.55;
    }

    /* ── Section ── */
    .section { margin-bottom: 24px; }
    .section-label {
      font-size: 0.7em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--vscode-panel-border);
    }

    /* ── Authors ── */
    .author-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .author-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
    }
    .author-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: 0.78em;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      letter-spacing: 0.03em;
    }
    .author-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .author-name {
      font-weight: 600;
      font-size: 0.9em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .author-links {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .author-link {
      font-size: 0.78em;
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .author-link:hover {
      text-decoration: underline;
    }

    /* ── Sponsors ── */
    .sponsor-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sponsor-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
    }
    .sponsor-avatar {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: var(--vscode-activityBarBadge-background, var(--vscode-badge-background));
      color: var(--vscode-activityBarBadge-foreground, var(--vscode-badge-foreground));
      font-size: 0.78em;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sponsor-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .sponsor-name-row { display: flex; align-items: center; gap: 7px; }
    .sponsor-name {
      font-weight: 600;
      font-size: 0.9em;
    }
    .sponsor-badge {
      font-size: 0.68em;
      padding: 1px 6px;
      border-radius: 20px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .sponsor-desc {
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
    }

    /* ── OSS ── */
    .oss-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .oss-item {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    }
    .oss-item:not(:last-child) {
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .oss-left { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
    .oss-name {
      font-weight: 500;
      font-size: 0.88em;
      white-space: nowrap;
    }
    .oss-desc {
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .oss-license {
      font-size: 0.68em;
      padding: 1px 6px;
      border-radius: 3px;
      background: var(--vscode-textCodeBlock-background);
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      letter-spacing: 0.03em;
      flex-shrink: 0;
    }
    .github-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.8em;
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      margin-top: 4px;
    }
    .github-link:hover { text-decoration: underline; }
    .oss-item-first {
      background: var(--vscode-list-hoverBackground, var(--vscode-sideBar-background, var(--vscode-editor-background)));
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="logo">NEXUS AI CODE</span>
    <span class="version">v1.0.8</span>
  </div>
  <p class="desc">${s.desc}</p>
  <a class="github-link" href="https://github.com/cuongngoht/NexusCode" target="_blank" rel="noopener">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
    ${s.repoLabel}
  </a>

  <div class="section">
    <p class="section-label">${s.sectionAuthor}</p>
    <div class="author-list">
      <div class="author-card">
        <div class="author-avatar">NTC</div>
        <div class="author-info">
          <span class="author-name">Ngô Hoàng Tuấn Cường</span>
          <div class="author-links">
            <a class="author-link" href="https://github.com/cuongngoht" target="_blank" rel="noopener">github.com/cuongngoht</a>
            <a class="author-link" href="https://x.com/cuongngoht" target="_blank" rel="noopener">x.com/cuongngoht</a>
          </div>
        </div>
      </div>
      <div class="author-card">
        <div class="author-avatar">THĐ</div>
        <div class="author-info">
          <span class="author-name">Trần Hồng Đông</span>
          <div class="author-links">
            <a class="author-link" href="https://github.com/dongth19" target="_blank" rel="noopener">github.com/dongth19</a>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <p class="section-label">${s.sectionSponsors}</p>
    <ul class="sponsor-list">
      <li class="sponsor-card">
        <div class="sponsor-avatar">KP</div>
        <div class="sponsor-body">
          <div class="sponsor-name-row">
            <span class="sponsor-name">Khám Phá Mới</span>
            <span class="sponsor-badge">${s.sponsorBadge}</span>
          </div>
          <span class="sponsor-desc">${s.sponsorKhamPhaDesc}</span>
        </div>
      </li>
    </ul>
  </div>

  <div class="section">
    <p class="section-label">${s.sectionOss}</p>
    <ul class="oss-list">
      ${ossItems}
    </ul>
  </div>

  <script nonce="${nonce}">void 0;</script>
</body>
</html>`;
}
