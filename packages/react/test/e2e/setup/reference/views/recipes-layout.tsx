import type { LayoutProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';

function RecipesLayout({ children }: LayoutProps) {
  return (
    <div data-testid="recipes-layout">
      <nav data-testid="recipes-sidebar">
        <Link href="/recipes">All</Link>
        <Link href="/recipes?category=Soups">Soups</Link>
        <Link href="/recipes?category=Pasta">Pasta</Link>
      </nav>
      <div>{children}</div>
    </div>
  );
}

RecipesLayout.displayName = 'RecipesLayout';

export default RecipesLayout;
