import type { LayoutProps } from '@nestjs-ssr/react';
import { Link, useNavigationState } from '@nestjs-ssr/react/client';
import { useRequest, useUser } from '../lib/ssr-hooks';

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
        <Link href="/" style={{ textDecoration: 'none', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>🍳 NestRecipes</h1>
        </Link>

        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/" style={isActive('/') ? activeLinkStyle : linkStyle}>
            Home
          </Link>
          <Link
            href="/recipes"
            style={isActive('/recipes') ? activeLinkStyle : linkStyle}
          >
            Recipes
          </Link>
        </nav>

        {navState === 'loading' && (
          <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>Loading...</span>
        )}

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

      <main style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
        {children}
      </main>

      <footer
        style={{
          borderTop: '1px solid #eee',
          padding: '1rem 2rem',
          textAlign: 'center',
          color: '#999',
          fontSize: '0.875rem',
        }}
      >
        Built with @nestjs-ssr/react — Controllers return data, components
        render it.
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

RootLayout.displayName = 'RootLayout';
