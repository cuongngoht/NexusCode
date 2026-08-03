/**
 * Builds webview-safe URLs for files inside the workspace.
 *
 * The extension host stamps `asWebviewUri(workspaceRoot)` onto `<body data-nexus-resource-base>`
 * (see src/webview/getHtml.ts) — one base URI, rather than a per-image round trip. `ChatController`
 * only holds a `post` callback and has no `vscode.Webview`, so it could not resolve URIs itself.
 */
export function toWorkspaceResourceUri(relPath: string): string | undefined {
  const base = document.body.dataset.nexusResourceBase;
  if (!base || !relPath) return undefined;

  // Encode each segment so spaces and unicode filenames survive, keeping separators intact.
  const encoded = relPath
    .split(/[\\/]/)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  if (!encoded) return undefined;

  return `${base.replace(/\/$/, '')}/${encoded}`;
}
