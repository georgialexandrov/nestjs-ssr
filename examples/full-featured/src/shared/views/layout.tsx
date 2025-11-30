import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function Layout({ children, title }: LayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header
        style={{
          backgroundColor: '#0066cc',
          color: 'white',
          padding: '20px',
        }}
      >
        <nav style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>
            {title || 'NestJS React SSR'}
          </h1>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a
              href="/"
              style={{ color: 'white', textDecoration: 'none' }}
            >
              Home
            </a>
            <a
              href="/users"
              style={{ color: 'white', textDecoration: 'none' }}
            >
              Users
            </a>
          </div>
        </nav>
      </header>
      <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
      <footer
        style={{
          backgroundColor: '#f5f5f5',
          padding: '20px',
          textAlign: 'center',
          color: '#666',
          fontSize: '14px',
        }}
      >
        <p style={{ margin: 0 }}>
          Built with NestJS + React SSR | Prototype by{' '}
          <a
            href="https://github.com"
            style={{ color: '#0066cc', textDecoration: 'none' }}
          >
            @yourname
          </a>
        </p>
      </footer>
    </div>
  );
}
