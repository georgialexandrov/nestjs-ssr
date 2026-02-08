import type { LayoutProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';
import { useRequest } from '../lib/ssr-hooks';

export default function RecipesLayout({ children }: LayoutProps) {
  const { path, query } = useRequest();
  const activeCategory = query?.category || null;

  const categories = ['Soups', 'Pasta', 'Drinks'];

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      {/* Category sidebar */}
      <nav
        style={{
          minWidth: '160px',
          paddingTop: '0.5rem',
        }}
      >
        <h3
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.875rem',
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Categories
        </h3>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
        >
          <Link
            href="/recipes"
            style={!activeCategory ? activeCatStyle : catStyle}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/recipes?category=${cat}`}
              style={activeCategory === cat ? activeCatStyle : catStyle}
            >
              {cat}
            </Link>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

const catStyle: React.CSSProperties = {
  color: '#555',
  textDecoration: 'none',
  padding: '0.4rem 0.75rem',
  borderRadius: '6px',
  fontSize: '0.9rem',
  transition: 'background-color 0.15s',
};

const activeCatStyle: React.CSSProperties = {
  ...catStyle,
  backgroundColor: '#1a1a2e',
  color: 'white',
};

RecipesLayout.displayName = 'RecipesLayout';
