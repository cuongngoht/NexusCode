import type { AnchorHTMLAttributes } from 'react';
import { getVsCodeApi } from '../../vscodeApi';

const SAFE_PROTOCOLS = new Set(['https:', 'http:']);
const BLOCKED_PROTOCOL_PREFIXES = ['javascript:', 'data:', 'vbscript:'];

function isBlockedProtocol(href: string): boolean {
  const lower = href.trim().toLowerCase();
  return BLOCKED_PROTOCOL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  children?: React.ReactNode;
}

export function LinkRenderer({ href, children, ...rest }: Props) {
  if (!href) return <span>{children}</span>;

  if (isBlockedProtocol(href)) {
    return <span title={href}>{children}</span>;
  }

  let isSafe = false;
  try {
    const url = new URL(href);
    isSafe = SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    // relative links (and other scheme-less hrefs) are ok
    isSafe = true;
  }

  if (!isSafe) return <span title={href}>{children}</span>;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    // Route likely workspace file paths (relative or absolute, no scheme or file:) to the proper workspace open handler.
    // This prevents trying to open non-existing files (e.g. "new file" references in plans) via openExternal,
    // which can surface "The editor could not be opened because the file was not found."
    // Also makes clicking file links in plans/outputs work for relative paths.
    const lower = href.trim().toLowerCase();
    const looksLikeFilePath =
      !lower.includes('://') || lower.startsWith('file:') || lower.startsWith('./') || lower.startsWith('../') || /^[a-zA-Z]:\\/.test(href) || href.includes('/');

    if (looksLikeFilePath) {
      // Strip any file: prefix for the path handler
      let p = href;
      if (p.toLowerCase().startsWith('file:')) {
        p = p.replace(/^file:\/+/i, '/');
      }
      getVsCodeApi().postMessage({ type: 'openWorkspaceFile', path: p });
      return;
    }

    getVsCodeApi().postMessage({ type: 'openExternal', url: href });
  };

  return (
    <a href={href} onClick={handleClick} rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
