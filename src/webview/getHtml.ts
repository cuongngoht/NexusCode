import * as vscode from 'vscode';
import * as crypto from 'crypto';

export function getHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  surface: 'chat' | 'dashboard' = 'chat',
  /** Workspace root — lets the webview build image URLs for attachment thumbnails. */
  workspaceUri?: vscode.Uri,
): string {
  const nonce = crypto.randomBytes(16).toString('hex');

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'webview', 'main.js'),
  );
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'webview', 'main.css'),
  );

  // `cspSource` is the same origin `asWebviewUri` produces, so one token covers both
  // bundled media and workspace files (attachment thumbnails).
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource} 'nonce-${nonce}'`,
  ].join('; ');

  const resourceBase = workspaceUri ? webview.asWebviewUri(workspaceUri).toString() : '';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nexus Chat</title>
  <link rel="stylesheet" href="${cssUri}" />
</head>
<body data-nexus-surface="${surface}" data-nexus-resource-base="${resourceBase}">
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
