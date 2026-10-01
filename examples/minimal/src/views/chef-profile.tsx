import type { PageProps } from '@nestjs-ssr/react';
import { Link, useNavigate } from '@nestjs-ssr/react/client';
import type { Recipe, Chef } from '../types.js';

interface ChefProfileProps {
  chef: Chef | null;
  recipes: Recipe[];
}

export default function ChefProfile({
  chef,
  recipes,
}: PageProps<ChefProfileProps>) {
  const navigate = useNavigate();

  if (!chef) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ fontSize: '3rem', margin: '0 0 1rem' }}>👨‍🍳</p>
        <h1>Chef Not Found</h1>
        <p style={{ color: 'var(--muted)' }}>This chef has left the kitchen.</p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-contrast)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          ← Back Home
        </button>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/recipes"
        style={{
          color: 'var(--muted)',
          textDecoration: 'none',
          fontSize: '0.9rem',
          display: 'inline-block',
          marginBottom: '1.5rem',
        }}
      >
        ← Back to Recipes
      </Link>

      {/* Chef info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-contrast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 'bold',
            flexShrink: 0,
          }}
        >
          {chef.name[0]}
        </div>
        <div>
          <h1 style={{ margin: '0 0 0.25rem' }}>{chef.name}</h1>
          <div
            style={{
              fontSize: '0.9rem',
              color: 'var(--muted)',
              marginBottom: '0.75rem',
            }}
          >
            {chef.specialty} · {chef.origin}
          </div>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--muted)' }}>
            {chef.bio}
          </p>
        </div>
      </div>

      {/* Chef's recipes */}
      <h2 style={{ margin: '0 0 1rem' }}>
        Recipes by {chef.name.split(' ')[0]}
      </h2>
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
              backgroundColor: 'var(--surface)',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>{recipe.emoji}</span>
            <div>
              <h3 style={{ margin: '0 0 0.15rem' }}>{recipe.name}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                {recipe.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

ChefProfile.displayName = 'ChefProfile';
