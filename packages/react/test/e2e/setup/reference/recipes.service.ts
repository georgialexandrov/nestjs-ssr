import { Injectable } from '@nestjs/common';

export interface Ingredient {
  amount: string;
  item: string;
}

export interface Recipe {
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

const recipes: Recipe[] = [
  {
    slug: 'lohikeitto',
    name: 'Lohikeitto',
    description: 'A classic Finnish salmon soup with potatoes and dill.',
    category: 'Soups',
    prepTime: '15 min',
    cookTime: '25 min',
    servings: 4,
    ingredients: [
      { amount: '400g', item: 'fresh salmon, cubed' },
      { amount: '4', item: 'medium potatoes, diced' },
      { amount: '1', item: 'leek, sliced' },
      { amount: '500ml', item: 'fish stock' },
      { amount: '200ml', item: 'heavy cream' },
      { amount: '1 bunch', item: 'fresh dill' },
    ],
    steps: [
      'Melt butter and saute leek until soft.',
      'Add potatoes and stock. Simmer 15 minutes.',
      'Add salmon and cook 5 minutes.',
      'Stir in cream and dill. Season to taste.',
    ],
  },
  {
    slug: 'tarator',
    name: 'Tarator',
    description: 'A cold Bulgarian yogurt soup with cucumbers and walnuts.',
    category: 'Soups',
    prepTime: '10 min',
    cookTime: '0 min',
    servings: 4,
    ingredients: [
      { amount: '400g', item: 'plain yogurt' },
      { amount: '2', item: 'cucumbers, diced' },
      { amount: '3 cloves', item: 'garlic, crushed' },
      { amount: '50g', item: 'walnuts, chopped' },
      { amount: '200ml', item: 'cold water' },
    ],
    steps: [
      'Mix yogurt with cold water until smooth.',
      'Add cucumbers, garlic, and walnuts.',
      'Season with salt. Refrigerate 30 minutes.',
      'Serve ice cold.',
    ],
  },
  {
    slug: 'carbonara',
    name: 'Spaghetti Carbonara',
    description: 'Four ingredients. No cream.',
    category: 'Pasta',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 4,
    ingredients: [
      { amount: '400g', item: 'spaghetti' },
      { amount: '200g', item: 'guanciale' },
      { amount: '4', item: 'egg yolks + 2 whole eggs' },
      { amount: '100g', item: 'Pecorino Romano' },
    ],
    steps: [
      'Boil pasta. Reserve 200ml pasta water before draining.',
      'Crisp guanciale in a cold pan over medium heat.',
      'Mix eggs and most of the Pecorino.',
      'Toss pasta with guanciale off heat.',
      'Add egg mixture off heat. Toss vigorously.',
    ],
  },
];

@Injectable()
export class RecipesService {
  findAll(): Recipe[] {
    return recipes;
  }

  findByCategory(category: string): Recipe[] {
    return recipes.filter(
      (r) => r.category.toLowerCase() === category.toLowerCase(),
    );
  }

  findBySlug(slug: string): Recipe | undefined {
    return recipes.find((r) => r.slug === slug);
  }

  getCategories(): string[] {
    return [...new Set(recipes.map((r) => r.category))];
  }

  getFeatured(): Recipe[] {
    return recipes.slice(0, 3);
  }
}
