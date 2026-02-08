import { Injectable } from '@nestjs/common';
import type { Recipe } from './types';

const recipes: Recipe[] = [
  {
    slug: 'lohikeitto',
    name: 'Lohikeitto',
    description:
      'A Finnish hug in a bowl. The Finns may not say much, but this salmon soup speaks volumes.',
    category: 'Soups',
    prepTime: '15 min',
    cookTime: '25 min',
    servings: 4,
    emoji: '🐟',
    chefId: 'mikko',
    ingredients: [
      { amount: '400g', item: 'fresh salmon, cubed' },
      { amount: '4', item: 'medium potatoes, diced' },
      { amount: '1', item: 'leek, sliced' },
      { amount: '2 tbsp', item: 'butter' },
      { amount: '500ml', item: 'fish stock' },
      { amount: '200ml', item: 'heavy cream' },
      { amount: '1 bunch', item: 'fresh dill' },
      { amount: 'to taste', item: 'salt and white pepper' },
    ],
    steps: [
      'Melt butter in a large pot over medium heat. Sauté leek until soft — about 3 minutes.',
      'Add diced potatoes and fish stock. Bring to a boil, then simmer for 15 minutes until potatoes are tender.',
      'Add salmon cubes and cook for 5 minutes. The salmon should be just opaque — do not overcook.',
      'Stir in heavy cream and most of the dill. Season with salt and white pepper.',
      'Serve in warm bowls with remaining dill on top. Eat in contemplative Finnish silence.',
    ],
  },
  {
    slug: 'tarator',
    name: 'Tarator',
    description:
      "Served cold because Bulgaria is hot and Bulgarians are practical. The ultimate 'too warm to cook' recipe.",
    category: 'Soups',
    prepTime: '10 min',
    cookTime: '0 min',
    servings: 4,
    emoji: '🥒',
    chefId: 'georgi',
    ingredients: [
      { amount: '400g', item: 'plain yogurt (full fat, no compromises)' },
      { amount: '2', item: 'cucumbers, finely diced' },
      { amount: '3 cloves', item: 'garlic, crushed' },
      { amount: '50g', item: 'walnuts, chopped' },
      { amount: '2 tbsp', item: 'olive oil' },
      { amount: '1 bunch', item: 'fresh dill' },
      { amount: '200ml', item: 'cold water' },
      { amount: 'to taste', item: 'salt' },
    ],
    steps: [
      'Mix yogurt with cold water until smooth. The consistency should be drinkable but not thin.',
      'Add finely diced cucumbers and crushed garlic. Yes, three cloves. This is not negotiable.',
      'Stir in chopped walnuts, olive oil, and chopped dill.',
      'Salt to taste. Refrigerate for at least 30 minutes.',
      'Serve ice cold. Add an ice cube to each bowl if you want to be authentic. Pairs well with warm bread and a hot day.',
    ],
  },
  {
    slug: 'carbonara',
    name: 'Spaghetti Carbonara',
    description: 'Four ingredients. No cream. We will not debate this.',
    category: 'Pasta',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 4,
    emoji: '🍝',
    chefId: 'marco',
    ingredients: [
      { amount: '400g', item: 'spaghetti' },
      { amount: '200g', item: 'guanciale, cut into strips' },
      { amount: '4', item: 'egg yolks + 2 whole eggs' },
      { amount: '100g', item: 'Pecorino Romano, finely grated' },
      { amount: 'generous', item: 'black pepper, freshly cracked' },
    ],
    steps: [
      'Bring a large pot of salted water to a boil. Cook spaghetti until al dente. Reserve 200ml pasta water before draining.',
      'While pasta cooks, crisp the guanciale in a cold pan over medium heat. No oil needed — it has plenty of its own fat.',
      'Mix egg yolks, whole eggs, and most of the Pecorino in a bowl. Add generous black pepper.',
      'Remove pan from heat. Add drained pasta to the guanciale pan. Toss to coat in the rendered fat.',
      'Pour the egg mixture over the pasta OFF THE HEAT. Toss vigorously — the residual heat cooks the eggs into a creamy sauce. Add pasta water if needed.',
      'Serve immediately with remaining Pecorino on top. If anyone asks about cream, change the subject.',
    ],
  },
  {
    slug: 'aperol-spritz',
    name: 'Aperol Spritz',
    description:
      'Technically a recipe. Legally a lifestyle. Best served at 6pm on a terrace you cannot afford.',
    category: 'Drinks',
    prepTime: '2 min',
    cookTime: '0 min',
    servings: 1,
    emoji: '🍹',
    chefId: 'marco',
    ingredients: [
      { amount: '90ml', item: 'Prosecco (cold)' },
      { amount: '60ml', item: 'Aperol' },
      { amount: 'splash', item: 'soda water' },
      { amount: '1', item: 'orange slice' },
      { amount: 'plenty', item: 'ice' },
    ],
    steps: [
      'Fill a large wine glass with ice. Do not be shy with the ice.',
      'Pour in the Prosecco first, then the Aperol. The ratio is 3:2 — this is not a suggestion.',
      'Add a splash of soda water. Just a splash.',
      'Garnish with an orange slice. Not a lemon. Not a lime. An orange.',
      'Sip slowly. Pretend you are in Venice. Ignore your surroundings.',
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

  findByChef(chefId: string): Recipe[] {
    return recipes.filter((r) => r.chefId === chefId);
  }

  getCategories(): string[] {
    return [...new Set(recipes.map((r) => r.category))];
  }

  getFeatured(): Recipe[] {
    // Return the first 3 as "featured"
    return recipes.slice(0, 3);
  }
}
