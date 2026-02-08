import type { PageProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';

interface Recipe {
  slug: string;
  name: string;
  description: string;
  category: string;
}

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
    <div data-testid="recipe-list">
      <h1>{activeCategory ? `${activeCategory} Recipes` : 'All Recipes'}</h1>
      <div>
        {recipes.map((recipe) => (
          <Link key={recipe.slug} href={`/recipes/${recipe.slug}`}>
            <div data-testid={`recipe-card-${recipe.slug}`}>
              <h3>{recipe.name}</h3>
              <p>{recipe.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

RecipeList.displayName = 'RecipeList';
