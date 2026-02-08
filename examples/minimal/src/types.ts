export interface Ingredient {
  amount: string;
  item: string;
}

export interface Recipe {
  slug: string;
  name: string;
  description: string;
  category: 'Soups' | 'Pasta' | 'Drinks';
  prepTime: string;
  cookTime: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  chefId: string;
  emoji: string;
}

export interface Chef {
  id: string;
  name: string;
  bio: string;
  specialty: string;
  origin: string;
}
