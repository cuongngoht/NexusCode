import type { AnchorHTMLAttributes } from 'react';
import { getVsCodeApi } from '../../vscodeApi';

const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  children?: React.ReactNode;
}

export function LinkRenderer({ href, children, ...rest }: Props) {
  if (!href) return <span>{children}</span>;

  let isSafe = false;
  try {
    const url = new URL(href);
    isSafe = SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    // relative links are ok
    isSafe = !href.startsWith('javascript:') && !href.startsWith('data:');
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
