import type { PageProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';
import type { Recipe } from '../../types';

interface SpecialsListProps {
  recipes: Recipe[];
  weekday: string;
}

/**
 * A view colocated inside the `specials` feature module
 * (src/specials/views/recipe-list.tsx).
 *
 * Note this file shares its basename — `recipe-list.tsx` — with the top-level
 * src/views/recipe-list.tsx, but exports a component with a distinct
 * `displayName`. This is the cross-submodule case: before the glob fix this view
 * was never bundled for hydration at all; the unique displayName is what lets the
 * client resolve it unambiguously from the one the server rendered.
 */
export default function SpecialsList({
  recipes,
  weekday,
}: PageProps<SpecialsListProps>) {
  return (
    <div>
      <h1 style={{ margin: '0 0 0.25rem' }}>Today's Specials</h1>
      <p style={{ color: '#666', margin: '0 0 1.5rem' }}>
        Hand-picked for {weekday}. {recipes.length} on the board.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {recipes.map((recipe) => (
          <Link
            key={recipe.slug}
            href={`/recipes/${recipe.slug}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: '#fffaf0',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #f0e6d2',
            }}
          >
            <span style={{ fontSize: '1.75rem' }}>{recipe.emoji}</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 0.2rem' }}>{recipe.name}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                {recipe.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

SpecialsList.displayName = 'SpecialsList';
