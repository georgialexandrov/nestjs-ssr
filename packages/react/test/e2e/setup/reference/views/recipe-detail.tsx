import { useState } from 'react';
import type { PageProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';

interface Ingredient {
  amount: string;
  item: string;
}

interface Recipe {
  slug: string;
  name: string;
  description: string;
  category: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
}

interface RecipeDetailProps {
  recipe: Recipe | null;
}

export default function RecipeDetail({ recipe }: PageProps<RecipeDetailProps>) {
  const [favorited, setFavorited] = useState(false);

  if (!recipe) {
    return (
      <div data-testid="recipe-detail">
        <h1>Recipe Not Found</h1>
      </div>
    );
  }

  return (
    <div data-testid="recipe-detail">
      <Link href="/recipes">Back to Recipes</Link>
      <h1 data-testid="recipe-name">{recipe.name}</h1>
      <p data-testid="recipe-description">{recipe.description}</p>
      <button
        data-testid="favorite-button"
        onClick={() => setFavorited(!favorited)}
      >
        {favorited ? 'Unfavorite' : 'Favorite'}
      </button>
      <span data-testid="favorite-status">
        {favorited ? 'Favorited' : 'Not favorited'}
      </span>
      <div>
        <h2>Ingredients</h2>
        <ul>
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>
              {ing.amount} {ing.item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Instructions</h2>
        <ol>
          {recipe.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

RecipeDetail.displayName = 'RecipeDetail';
