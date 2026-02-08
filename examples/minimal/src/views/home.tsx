import type { PageProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';
import type { Recipe } from '../types';

interface HomeProps {
  featured: Recipe[];
}

export default function Home({ featured }: PageProps<HomeProps>) {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem' }}>Good food, honest code.</h1>
        <p style={{ color: '#666', fontSize: '1.1rem', margin: 0 }}>
          A recipe collection that proves NestJS and React can cook together.
        </p>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Featured Recipes</h2>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}
      >
        {featured.map((recipe) => (
          <Link
            key={recipe.slug}
            href={`/recipes/${recipe.slug}`}
            style={{
              display: 'block',
              padding: '1.25rem',
              backgroundColor: '#f8f8f8',
              borderRadius: '10px',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #eee',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            <div
              style={{
                fontSize: '2rem',
                marginBottom: '0.5rem',
              }}
            >
              {recipe.emoji}
            </div>
            <h3 style={{ margin: '0 0 0.25rem' }}>{recipe.name}</h3>
            <p
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.875rem',
                color: '#666',
                lineHeight: 1.5,
              }}
            >
              {recipe.description}
            </p>
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                fontSize: '0.8rem',
                color: '#999',
              }}
            >
              <span>⏱ {recipe.prepTime} prep</span>
              <span>🔥 {recipe.cookTime} cook</span>
              <span>👥 {recipe.servings}</span>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link
          href="/recipes"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            backgroundColor: '#1a1a2e',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontSize: '0.9rem',
          }}
        >
          Browse All Recipes →
        </Link>
      </div>
    </div>
  );
}
