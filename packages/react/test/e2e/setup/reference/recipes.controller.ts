import { Controller, Get, Param, Query } from '@nestjs/common';
import { Render, Layout } from '@nestjs-ssr/react';
import { RecipesService } from './recipes.service';
import RecipesLayout from './views/recipes-layout';
import RecipeList from './views/recipe-list';
import RecipeDetail from './views/recipe-detail';

@Controller('recipes')
@Layout(RecipesLayout)
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  @Render(RecipeList)
  getRecipes(@Query('category') category?: string) {
    const allRecipes = category
      ? this.recipes.findByCategory(category)
      : this.recipes.findAll();

    return {
      props: {
        recipes: allRecipes,
        categories: this.recipes.getCategories(),
        activeCategory: category || null,
      },
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
        props: { recipe: null },
        head: { title: 'Recipe Not Found — NestRecipes' },
      };
    }

    return {
      props: { recipe },
      head: {
        title: `${recipe.name} — NestRecipes`,
        description: recipe.description,
      },
    };
  }
}
