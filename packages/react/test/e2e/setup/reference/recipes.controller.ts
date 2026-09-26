import { Controller, Get, Param, Query } from '@nestjs/common';
import { Render, Layout, api, page, representations } from '@nestjs-ssr/react';
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

  /**
   * Distinct DTOs: the page renders the whole recipe, the API answers with a
   * flat summary. Only the negotiated representation is built.
   */
  @Get(':slug')
  @Render(RecipeDetail)
  getRecipe(@Param('slug') slug: string) {
    const recipe = this.recipes.findBySlug(slug);
    if (!recipe) {
      return representations({
        html: page({
          props: { recipe: null },
          head: { title: 'Recipe Not Found — NestRecipes' },
        }),
        json: api({ error: 'not_found', slug }),
      });
    }

    return representations({
      html: page({
        props: { recipe },
        head: {
          title: `${recipe.name} — NestRecipes`,
          description: recipe.description,
        },
      }),
      json: api(() => ({
        slug: recipe.slug,
        name: recipe.name,
        representation: 'api',
      })),
    });
  }

  /** HTML only: a JSON request here must be refused with a 406. */
  @Get('private/dashboard')
  @Render(RecipeList, { representation: { json: false } })
  getPrivateDashboard() {
    return {
      props: {
        recipes: this.recipes.findAll(),
        categories: this.recipes.getCategories(),
        activeCategory: null,
      },
      head: { title: 'Private — NestRecipes' },
    };
  }
}
