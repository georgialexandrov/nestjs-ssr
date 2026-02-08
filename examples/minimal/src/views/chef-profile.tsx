import type { PageProps } from '@nestjs-ssr/react';
import { Link, useNavigate } from '@nestjs-ssr/react/client';
import type { Recipe, Chef } from '../types';

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
        <p style={{ color: '#666' }}>This chef has left the kitchen.</p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1a1a2e',
            color: 'white',
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
          color: '#666',
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
            backgroundColor: '#1a1a2e',
            color: 'white',
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
              color: '#666',
              marginBottom: '0.75rem',
            }}
          >
            {chef.specialty} · {chef.origin}
          </div>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#444' }}>
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
              backgroundColor: '#f8f8f8',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #eee',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>{recipe.emoji}</span>
            <div>
              <h3 style={{ margin: '0 0 0.15rem' }}>{recipe.name}</h3>
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

ChefProfile.displayName = 'ChefProfile';
