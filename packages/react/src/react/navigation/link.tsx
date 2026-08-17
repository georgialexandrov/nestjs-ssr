import React from 'react';
import { navigate } from './navigate';
import { isSameOrigin } from './same-origin';

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

    // navigate() handles its own failures and falls back to a full page load,
    // but the optimistic context update runs before its try block. Catching
    // here keeps a throw from that path from surfacing as an unhandled
    // rejection with the click already default-prevented — the link would
    // otherwise do nothing at all.
    navigate(href, { replace, scroll }).catch((error: unknown) => {
      console.error('[navigation] Navigation failed:', error);
      window.location.href = href;
    });
  };

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
