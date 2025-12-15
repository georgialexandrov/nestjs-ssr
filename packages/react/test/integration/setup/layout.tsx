import React from 'react';
import type { LayoutProps } from '@nestjs-ssr/react';

function RootLayout({ children }: LayoutProps) {
  return (
    <div data-testid="root-layout" className="root-layout">
      <header data-testid="layout-header">
        <h1>Test App</h1>
      </header>
      <main>{children}</main>
      <footer data-testid="layout-footer">
        <p>Footer content</p>
      </footer>
    </div>
  );
}

RootLayout.displayName = 'RootLayout';

export default RootLayout;
