import type { LayoutProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';

function RootLayout({ children }: LayoutProps) {
  return (
    <div data-testid="root-layout">
      <header data-testid="layout-header">
        <nav data-testid="layout-nav">
          <Link href="/">Home</Link>
          <Link href="/recipes">Recipes</Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

RootLayout.displayName = 'RootLayout';

export default RootLayout;
