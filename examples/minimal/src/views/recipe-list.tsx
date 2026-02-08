import type { PageProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';
import type { Recipe } from '../types';

interface RecipeListProps {
  recipes: Recipe[];
  categories: string[];
  activeCategory: string | null;
}

export default function RecipeList({
  recipes,
  activeCategory,
}: PageProps<RecipeListProps>) {
  return (
    <div>
      <h1 style={{ margin: '0 0 0.25rem' }}>
        {activeCategory ? `${activeCategory} Recipes` : 'All Recipes'}
      </h1>
      <p style={{ color: '#666', margin: '0 0 1.5rem' }}>
        {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} found
        {activeCategory ? ` in ${activeCategory}` : ''}
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
              backgroundColor: '#f8f8f8',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #eee',
            }}
          >
            <span style={{ fontSize: '1.75rem' }}>{recipe.emoji}</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 0.2rem' }}>{recipe.name}</h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.85rem',
                  color: '#666',
                }}
              >
                {recipe.description}
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '0.2rem',
                fontSize: '0.8rem',
                color: '#999',
                whiteSpace: 'nowrap',
              }}
            >
              <span>
                {recipe.prepTime} + {recipe.cookTime}
              </span>
              <span>
                {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {recipes.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#999',
          }}
        >
          <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>🍽</p>
          <p>No recipes found in this category. The chef is on break.</p>
        </div>
      )}
    </div>
  );
}

RecipeList.displayName = 'RecipeList';
