import { Controller, Get, Param, Query } from '@nestjs/common';
import { Render, Layout, api, page, representations } from '@nestjs-ssr/react';
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

  /**
   * The simple case: one payload serves both representations.
   *
   * These page props are already a public view model, so `representation.json`
   * from the module configuration is all this route needs — HTML and JSON
   * share the object below.
   */
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

  /**
   * The distinct-DTO case: the page and the API want different shapes.
   *
   * The page needs the chef object to render a byline and the JSON-LD block;
   * the API contract is a flat recipe document with just the chef's name.
   * `representations()` gives each its own type, and only the representation
   * the request negotiates is built and serialized.
   */
  @Get(':slug')
  @Render(RecipeDetail)
  getRecipe(@Param('slug') slug: string) {
    const recipe = this.recipes.findBySlug(slug);

    if (!recipe) {
      return representations({
        html: page({
          props: { recipe: null, chef: null },
          head: { title: 'Recipe Not Found — NestRecipes' },
        }),
        json: api({ error: 'not_found', slug }),
      });
    }

    const chef = this.chefs.findById(recipe.chefId);

    return representations({
      html: page({
        props: { recipe, chef: chef || null },
        head: {
          title: `${recipe.name} — NestRecipes`,
          description: recipe.description,
          // JSON-LD structured data for Google rich results
          jsonLd: [
            {
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
          ],
        },
      }),
      // Lazy: this DTO is only built when the client negotiates JSON.
      json: api(() => ({
        slug: recipe.slug,
        name: recipe.name,
        description: recipe.description,
        category: recipe.category,
        servings: recipe.servings,
        chef: chef?.name ?? null,
        ingredients: recipe.ingredients,
      })),
    });
  }
}
