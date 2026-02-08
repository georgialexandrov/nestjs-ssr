# @nestjs-ssr/react

[![npm version](https://img.shields.io/npm/v/@nestjs-ssr/react)](https://www.npmjs.com/package/@nestjs-ssr/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**React SSR for NestJS. One app. One deploy. Full type safety from database to DOM.**

No separate frontend. No second router. No type boundary you maintain by hand. Controllers return data, components render it, TypeScript enforces the contract.

**[Documentation](https://georgialexandrov.github.io/nestjs-ssr/)** | **[Get Started](https://georgialexandrov.github.io/nestjs-ssr/guide/installation)**

## The whole contract in two files

```typescript
// recipes.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { Render, Layout } from '@nestjs-ssr/react';
import { RecipesLayout } from './views/recipes-layout';
import { RecipeDetail } from './views/recipe-detail';

@Controller('recipes')
@Layout(RecipesLayout)
export class RecipesController {
  @Get(':slug')
  @Render(RecipeDetail)
  getRecipe(@Param('slug') slug: string) {
    const recipe = this.recipes.findBySlug(slug);
    return {
      recipe,
      chef: this.chefs.findById(recipe.chefId),
      head: { title: recipe.name },
    };
  }
}
```

```tsx
// recipe-detail.tsx
import { PageProps } from '@nestjs-ssr/react';

export default function RecipeDetail({
  recipe,
  chef,
}: PageProps<RecipeDetailProps>) {
  return (
    <article>
      <h1>{recipe.name}</h1>
      <p>{recipe.description}</p>
      <IngredientList items={recipe.ingredients} />
      <ChefCard chef={chef} />
    </article>
  );
}
```

Return the wrong shape and TypeScript catches it before the code runs.

## Nothing breaks

Your NestJS app stays exactly as it is. Routing, guards, pipes, interceptors, services, modules, testing — all unchanged. You're adding a view layer, not rewriting your backend.

## Everything improves

- **One type, both sides** — controller return type is the component's props. Change one, the other breaks at build time.
- **Layouts that stay put** — nested layouts persist across navigations. Header, sidebar, shell — rendered once, never re-mounted.
- **No full reloads** — link clicks fetch only the changed segment. State, scroll position, animations stay alive.
- **Stream or string** — `renderToString` for simplicity, `renderToPipeableStream` for performance. Suspense boundaries stream as they resolve.
- **SEO out of the box** — title, meta, Open Graph, JSON-LD. Return `head` from your controller.
- **Vite HMR** — instant updates, no page refresh. Works with Express and Fastify.

## Add it to an existing NestJS app

```bash
npx @nestjs-ssr/react init
```

One command. Works with Express and Fastify.

## Requirements

Node.js 20+ / NestJS 11+ / React 19+ / Vite 6+ / TypeScript 5+

## Documentation

**[georgialexandrov.github.io/nestjs-ssr](https://georgialexandrov.github.io/nestjs-ssr/)**

- [Installation](https://georgialexandrov.github.io/nestjs-ssr/guide/installation)
- [Rendering](https://georgialexandrov.github.io/nestjs-ssr/guide/rendering)
- [Layouts](https://georgialexandrov.github.io/nestjs-ssr/guide/layouts)
- [Client-Side Navigation](https://georgialexandrov.github.io/nestjs-ssr/guide/navigation)
- [Request Context](https://georgialexandrov.github.io/nestjs-ssr/guide/request-context)
- [Configuration](https://georgialexandrov.github.io/nestjs-ssr/guide/configuration)
- [API Reference](https://georgialexandrov.github.io/nestjs-ssr/guide/api)

## Contributing

```bash
git clone https://github.com/georgialexandrov/nestjs-ssr.git
cd nestjs-ssr
pnpm install
pnpm build:package
pnpm test
```

## License

MIT
