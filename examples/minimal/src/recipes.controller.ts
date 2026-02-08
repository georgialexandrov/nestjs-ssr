import { Controller, Get, Param, Query } from '@nestjs/common';
import { Render, Layout } from '@nestjs-ssr/react';
import { RecipesService } from './recipes.service';
import { ChefsService } from './chefs.service';
import RecipesLayout from './views/recipes-layout';
import RecipeList from './views/recipe-list';
import RecipeDetail from './views/recipe-detail';

@Controller('recipes')
@Layout(RecipesLayout)
export class RecipesController {
  constructor(
    private readonly recipes: RecipesService,
    private readonly chefs: ChefsService,
  ) {}

  @Get()
  @Render(RecipeList)
  getRecipes(@Query('category') category?: string) {
    const allRecipes = category
      ? this.recipes.findByCategory(category)
      : this.recipes.findAll();

    return {
      recipes: allRecipes,
      categories: this.recipes.getCategories(),
      activeCategory: category || null,
      head: {
        title: category
          ? `${category} Recipes — NestRecipes`
          : 'All Recipes — NestRecipes',
      },
    };
  }

  @Get(':slug')
  @Render(RecipeDetail)
  getRecipe(@Param('slug') slug: string) {
    const recipe = this.recipes.findBySlug(slug);
    if (!recipe) {
      return {
        recipe: null,
        chef: null,
        head: { title: 'Recipe Not Found — NestRecipes' },
      };
    }

    const chef = this.chefs.findById(recipe.chefId);

    return {
      recipe,
      chef: chef || null,
      head: {
        title: `${recipe.name} — NestRecipes`,
        description: recipe.description,
        // JSON-LD structured data for Google rich results
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Recipe',
          name: recipe.name,
          description: recipe.description,
          prepTime: `PT${parseInt(recipe.prepTime)}M`,
          cookTime: `PT${parseInt(recipe.cookTime)}M`,
          recipeYield: `${recipe.servings} servings`,
          recipeIngredient: recipe.ingredients.map(
            (i) => `${i.amount} ${i.item}`,
          ),
          recipeInstructions: recipe.steps.map((step, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            text: step,
          })),
        },
      },
    };
  }
}
