import type { PageProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';

interface Recipe {
  slug: string;
  name: string;
  description: string;
}

interface HomeProps {
  featured: Recipe[];
}

export default function Home({ featured }: PageProps<HomeProps>) {
  return (
    <div data-testid="home-page">
      <h1>NestRecipes</h1>
      <div data-testid="featured-recipes">
        {featured.map((recipe) => (
          <Link key={recipe.slug} href={`/recipes/${recipe.slug}`}>
            <div data-testid={`featured-${recipe.slug}`}>
              <h3>{recipe.name}</h3>
              <p>{recipe.description}</p>
            </div>
          </Link>
        ))}
      </div>
      <Link href="/recipes">Browse All Recipes</Link>
    </div>
  );
}

Home.displayName = 'Home';
