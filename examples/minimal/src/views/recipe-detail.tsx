import type { PageProps } from '@nestjs-ssr/react';
import { Link, useNavigate } from '@nestjs-ssr/react/client';
import type { Recipe, Chef } from '../types';

interface RecipeDetailProps {
  recipe: Recipe | null;
  chef: Chef | null;
}

export default function RecipeDetail({
  recipe,
  chef,
}: PageProps<RecipeDetailProps>) {
  const navigate = useNavigate();

  if (!recipe) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ fontSize: '3rem', margin: '0 0 1rem' }}>🤔</p>
        <h1>Recipe Not Found</h1>
        <p style={{ color: '#666' }}>
          This recipe has gone missing. Probably someone ate it.
        </p>
        <button onClick={() => navigate('/recipes')} style={backButtonStyle}>
          ← Back to Recipes
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
          marginBottom: '1rem',
        }}
      >
        ← Back to Recipes
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <span style={{ fontSize: '2.5rem' }}>{recipe.emoji}</span>
        <h1 style={{ margin: '0.5rem 0 0.25rem' }}>{recipe.name}</h1>
        <p style={{ color: '#666', fontSize: '1.05rem', margin: '0 0 1rem' }}>
          {recipe.description}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            fontSize: '0.9rem',
            color: '#555',
          }}
        >
          <span>⏱ Prep: {recipe.prepTime}</span>
          <span>🔥 Cook: {recipe.cookTime}</span>
          <span>👥 Serves: {recipe.servings}</span>
          <span
            style={{
              backgroundColor: '#f0f0f0',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            {recipe.category}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.5fr',
          gap: '2rem',
        }}
      >
        {/* Ingredients */}
        <div>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
            Ingredients
          </h2>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {recipe.ingredients.map((ing, i) => (
              <li
                key={i}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f8f8f8',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                }}
              >
                <strong style={{ color: '#333' }}>{ing.amount}</strong>{' '}
                <span style={{ color: '#666' }}>{ing.item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Steps */}
        <div>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
            Instructions
          </h2>
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {recipe.steps.map((step, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: '1.75rem',
                    height: '1.75rem',
                    borderRadius: '50%',
                    backgroundColor: '#1a1a2e',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    marginTop: '0.1rem',
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ color: '#444' }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Chef card */}
      {chef && (
        <Link
          href={`/chefs/${chef.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#f8f8f8',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'inherit',
            border: '1px solid #eee',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#1a1a2e',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 'bold',
            }}
          >
            {chef.name[0]}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>by {chef.name}</div>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              {chef.specialty} · {chef.origin}
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}

const backButtonStyle: React.CSSProperties = {
  marginTop: '1rem',
  padding: '0.75rem 1.5rem',
  backgroundColor: '#1a1a2e',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

RecipeDetail.displayName = 'RecipeDetail';
