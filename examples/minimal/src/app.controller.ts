import { Controller, Get } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import { RecipesService } from './recipes.service';
import Home from './views/home';

@Controller()
export class AppController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  @Render(Home)
  getHome() {
    return {
      featured: this.recipes.getFeatured(),
      head: {
        title: 'NestRecipes — Good food, honest code',
        description:
          'A recipe collection built with NestJS SSR. Because developers need to eat too.',
      },
    };
  }
}
