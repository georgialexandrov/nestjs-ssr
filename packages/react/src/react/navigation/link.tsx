import React from 'react';
import { navigate } from './navigate';

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** The URL to navigate to */
  href: string;
  /** Use replaceState instead of pushState. Default: false */
  replace?: boolean;
  /** Scroll to top after navigation. Default: true */
  scroll?: boolean;
}

/**
 * Client-side navigation link component.
 * Performs segment rendering for same-origin navigation.
 *
 * Falls back to default browser navigation for:
 * - External links (different origin)
 * - Modified clicks (ctrl/cmd/shift/alt)
 * - Middle mouse button clicks
 * - Links with target="_blank"
 */
export function Link({
  href,
  replace = false,
  scroll = true,
  children,
  onClick,
  ...props
}: LinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Allow default behavior for:
    // - Modified clicks (ctrl/cmd/shift/alt)
    // - Middle mouse button
    // - External links
    // - Links with target="_blank"
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0 ||
      props.target === '_blank' ||
      !isSameOrigin(href)
    ) {
      onClick?.(e);
      return;
    }

    e.preventDefault();
    onClick?.(e);

    navigate(href, { replace, scroll });
  };

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}

/**
 * Check if a URL is same-origin (safe for client-side navigation).
 */
function isSameOrigin(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    // Invalid URL or relative path - treat as same-origin
    return true;
  }
}
