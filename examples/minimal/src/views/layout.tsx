import type { LayoutProps } from '@nestjs-ssr/react';
import { Link, useNavigationState, useRequest } from '@nestjs-ssr/react/client';

/**
 * Root layout with navigation header.
 * This layout wraps all pages and provides:
 * - Navigation links using client-side segment rendering
 * - Loading indicator during navigation
 * - Consistent page structure
 */
export default function RootLayout({ children }: LayoutProps) {
  const navState = useNavigationState();
  const { path } = useRequest();

  const isActive = (href: string) => {
    if (href === '/') return path === '/';
    return path.startsWith(href);
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
      {/* Navigation Header */}
      <header
        style={{
          backgroundColor: '#1a1a2e',
          color: 'white',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>NestJS SSR</h1>

        <nav style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/" style={isActive('/') ? activeLinkStyle : linkStyle}>
            Home
          </Link>
          <Link
            href="/about"
            style={isActive('/about') ? activeLinkStyle : linkStyle}
          >
            About
          </Link>
          <Link
            href="/users"
            style={isActive('/users') ? activeLinkStyle : linkStyle}
          >
            Users
          </Link>
        </nav>

        {/* Loading indicator during navigation */}
        {navState === 'loading' && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.875rem',
              opacity: 0.7,
            }}
          >
            Loading...
          </span>
        )}
      </header>

      {/* Page Content */}
      <main style={{ padding: '2rem' }}>{children}</main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #eee',
          padding: '1rem 2rem',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.875rem',
        }}
      >
        Segment rendering demo - Click nav links to see client-side navigation
      </footer>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  color: 'white',
  textDecoration: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '4px',
  transition: 'background-color 0.2s',
};

const activeLinkStyle: React.CSSProperties = {
  ...linkStyle,
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
};
