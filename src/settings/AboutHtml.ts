import * as vscode from 'vscode';
import * as crypto from 'crypto';

type Locale = 'vi' | 'en';

const STRINGS = {
  vi: {
    title: 'Giới thiệu Nexus Code',
    desc: 'Giao diện chat định tuyến prompt đến các CLI coding agent đã cài.',
    sectionAuthor: 'Tác giả',
    sectionSponsors: 'Nhà tài trợ',
    sponsorBadge: 'Nhà tài trợ',
    sponsorKhamPhaDesc: 'Đồng hành và hỗ trợ phát triển dự án',
    sectionOss: 'Mã nguồn mở',
    ossReact: 'Thư viện UI',
    ossFluentUi: 'Hệ thống thiết kế của Microsoft',
    ossVscodeApi: 'Nền tảng extension của Microsoft',
    ossCommander: 'Framework CLI',
    ossZod: 'Validation schema',
    ossVite: 'Công cụ build frontend',
  },
  en: {
    title: 'About Nexus Code',
    desc: 'A chat cockpit that routes prompts to installed CLI coding agents.',
    sectionAuthor: 'Author',
    sectionSponsors: 'Sponsors',
    sponsorBadge: 'Sponsor',
    sponsorKhamPhaDesc: 'Supporting project development',
    sectionOss: 'Open Source',
    ossReact: 'UI component library',
    ossFluentUi: 'Microsoft design system',
    ossVscodeApi: 'Extension platform by Microsoft',
    ossCommander: 'CLI framework',
    ossZod: 'Schema validation',
    ossVite: 'Frontend build tool',
  },
} satisfies Record<Locale, Record<string, string>>;

function resolveLocale(): Locale {
  return vscode.env.language.startsWith('vi') ? 'vi' : 'en';
}

export function getAboutHtml(webview: vscode.Webview): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const s = STRINGS[resolveLocale()];

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
  </style>
</head>
<body>
  <div class="header">
    <span class="logo">NEXUS CODE</span>
    <span class="version">v1.0.8</span>
  </div>
  <p class="desc">${s.desc}</p>

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
      <li class="oss-item">
        <div class="oss-left">
          <span class="oss-name">React 19</span>
          <span class="oss-desc">${s.ossReact}</span>
        </div>
        <span class="oss-license">MIT</span>
      </li>
      <li class="oss-item">
        <div class="oss-left">
          <span class="oss-name">Fluent UI React v9</span>
          <span class="oss-desc">${s.ossFluentUi}</span>
        </div>
        <span class="oss-license">MIT</span>
      </li>
      <li class="oss-item">
        <div class="oss-left">
          <span class="oss-name">VS Code Extension API</span>
          <span class="oss-desc">${s.ossVscodeApi}</span>
        </div>
        <span class="oss-license">MIT</span>
      </li>
      <li class="oss-item">
        <div class="oss-left">
          <span class="oss-name">Commander</span>
          <span class="oss-desc">${s.ossCommander}</span>
        </div>
        <span class="oss-license">MIT</span>
      </li>
      <li class="oss-item">
        <div class="oss-left">
          <span class="oss-name">Zod</span>
          <span class="oss-desc">${s.ossZod}</span>
        </div>
        <span class="oss-license">MIT</span>
      </li>
      <li class="oss-item">
        <div class="oss-left">
          <span class="oss-name">Vite</span>
          <span class="oss-desc">${s.ossVite}</span>
        </div>
        <span class="oss-license">MIT</span>
      </li>
    </ul>
  </div>

  <script nonce="${nonce}">void 0;</script>
</body>
</html>`;
}
