import type { LayoutProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';
import { useRequest } from '../lib/ssr-hooks';

/**
 * Users section layout with submenu.
 * This is a nested layout that wraps all /users/* pages.
 * It sits between RootLayout and the page component.
 */
export default function UsersLayout({ children }: LayoutProps) {
  const { path } = useRequest();

  const isActive = (href: string) => path === href;

  return (
    <div>
      {/* Users submenu */}
      <nav
        style={{
          backgroundColor: '#f5f5f5',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          gap: '1rem',
        }}
      >
        <span style={{ fontWeight: 'bold', marginRight: '1rem' }}>Users:</span>
        <Link
          href="/users"
          style={isActive('/users') ? activeSubLinkStyle : subLinkStyle}
        >
          All Users
        </Link>
        <Link
          href="/users/settings"
          style={
            isActive('/users/settings') ? activeSubLinkStyle : subLinkStyle
          }
        >
          Settings
        </Link>
      </nav>

      {/* Page content */}
      <div style={{ padding: '1rem' }}>{children}</div>
    </div>
  );
}

const subLinkStyle: React.CSSProperties = {
  color: '#333',
  textDecoration: 'none',
  padding: '0.25rem 0.5rem',
  borderRadius: '4px',
};

const activeSubLinkStyle: React.CSSProperties = {
  ...subLinkStyle,
  backgroundColor: '#1a1a2e',
  color: 'white',
};

UsersLayout.displayName = 'UsersLayout';
