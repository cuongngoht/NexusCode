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
    getVsCodeApi().postMessage({ type: 'openExternal', url: href });
  };

  return (
    <a href={href} onClick={handleClick} rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
