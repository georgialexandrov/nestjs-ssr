import { Controller, Get, Param } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import { ChefsService } from './chefs.service';
import { RecipesService } from './recipes.service';
import ChefProfile from './views/chef-profile';

@Controller('chefs')
export class ChefsController {
  constructor(
    private readonly chefs: ChefsService,
    private readonly recipes: RecipesService,
  ) {}

  @Get(':id')
  @Render(ChefProfile)
  getChef(@Param('id') id: string) {
    const chef = this.chefs.findById(id);
    if (!chef) {
      return {
        chef: null,
        recipes: [],
        head: { title: 'Chef Not Found — NestRecipes' },
      };
    }

    return {
      chef,
      recipes: this.recipes.findByChef(id),
      head: {
        title: `${chef.name} — NestRecipes`,
        description: `${chef.specialty} by ${chef.name} from ${chef.origin}`,
      },
    };
  }
}
