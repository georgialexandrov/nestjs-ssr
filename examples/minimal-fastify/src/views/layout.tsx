import type { LayoutProps } from '@nestjs-ssr/react';
import { Link, useNavigationState } from '@nestjs-ssr/react/client';
import { useRequest, useUser } from '../lib/ssr-hooks';

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
  const user = useUser();

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
              fontSize: '0.875rem',
              opacity: 0.7,
            }}
          >
            Loading...
          </span>
        )}

        {/* User info from context - populated by auth guard via context factory */}
        {user && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
            }}
          >
            <span
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
              }}
            >
              {user.role}
            </span>
            <span>{user.name}</span>
          </div>
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

// Preserve component name in production builds
RootLayout.displayName = 'RootLayout';
