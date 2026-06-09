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
  </style>
</head>
<body>
  <div class="header">
    <span class="logo">NEXUS</span>
    <span class="version">v0.1.3</span>
  </div>
  <p class="desc">${s.desc}</p>

  <hr />

  <h2>${s.sectionAuthor}</h2>
  <div class="author-row">
    <span class="author-name">Ngô Hoàng Tuấn Cường</span>
    <span class="author-github">github.com/cuongngoht</span>
  </div>
  <div class="author-row">
    <span class="author-name">Trần Hồng Đông</span>
    <span class="author-github">github.com/dongth19</span>
  </div>

  <hr />

  <h2>${s.sectionSponsors}</h2>
  <ul class="sponsor-list">
    <li class="sponsor-item">
      <span class="sponsor-name">Khám Phá Mới</span>
      <span class="sponsor-badge">${s.sponsorBadge}</span>
      <span class="sponsor-desc">${s.sponsorKhamPhaDesc}</span>
    </li>
  </ul>

  <hr />

  <h2>${s.sectionOss}</h2>
  <ul class="oss-list">
    <li class="oss-item">
      <span class="oss-name">React 19</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">${s.ossReact}</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">Fluent UI React v9</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">${s.ossFluentUi}</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">VS Code Extension API</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">${s.ossVscodeApi}</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">Commander</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">${s.ossCommander}</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">Zod</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">${s.ossZod}</span>
    </li>
    <li class="oss-item">
      <span class="oss-name">Vite</span>
      <span class="oss-license">MIT</span>
      <span class="oss-desc">${s.ossVite}</span>
    </li>
  </ul>

  <script nonce="${nonce}">void 0;</script>
</body>
</html>`;
}
