import { Controller, Get } from '@nestjs/common';
import { Render, Layout } from '@nestjs-ssr/react';
import { RecipesService } from '../recipes.service';
import RecipesLayout from '../views/recipes-layout';
import SpecialsList from './views/recipe-list';

/**
 * A feature module controller whose view is colocated under
 * src/specials/views/ rather than the top-level src/views/.
 *
 * This exercises submodule view discovery: the client glob must pick up
 * `views` directories anywhere under the source root, and the resolver must
 * map the server-rendered component back to this colocated file.
 */
@Controller('specials')
@Layout(RecipesLayout)
export class SpecialsController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  @Render(SpecialsList)
  getSpecials() {
    const weekday = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ][new Date().getDay()];

    return {
      recipes: this.recipes.getFeatured(),
      weekday,
      head: {
        title: "Today's Specials — NestRecipes",
        description: 'A colocated feature-module view rendered via SSR.',
      },
    };
  }
}
