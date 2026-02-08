---
layout: page
pageClass: landing-page
---

<HeroSection />

<div class="features-grid">
  <div class="feature-card">
    <div class="feature-icon">🔒</div>
    <h3>One Type, Both Sides</h3>
    <p>Controller return type is the component's props. Change one, the other breaks at build time.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">🏗️</div>
    <h3>Layouts That Stay Put</h3>
    <p>Nested layouts persist across navigations. Header, sidebar, shell — rendered once, never re-mounted.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">⚡</div>
    <h3>Stream or String</h3>
    <p>renderToString for simplicity, renderToPipeableStream for performance. Suspense boundaries stream as they resolve.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">🧭</div>
    <h3>No Full Reloads</h3>
    <p>Link clicks fetch only the changed segment. The rest of the page stays alive — state, scroll, animations.</p>
  </div>
</div>

<div class="content-section">

## You don't need a second app

The standard approach to SSR with a backend framework: build the API, then build a separate frontend app that calls it. Whether it's Next.js, TanStack Start, Remix, or a plain Vite SPA — you end up with two routers, two deploys, and a type boundary you maintain by hand.

This library takes a different approach. React lives inside your NestJS app as a view layer. Controllers return data, components render it, TypeScript enforces the contract. One process, one build, one deploy.

</div>

<div class="content-section columns-section">

<div class="two-columns">
<div class="column-card">

### Nothing breaks

- NestJS routing, guards, pipes, interceptors
- Your existing services and modules
- Server-side testing without touching React
- Full control over the request lifecycle

</div>
<div class="column-card">

### Everything improves

- React components as views, not a separate app
- End-to-end type safety from DB to DOM
- Nested layouts with persistent shared chrome
- Vite HMR — instant updates, no page refresh
- SEO out of the box: title, meta, Open Graph

</div>
</div>

</div>

<div class="content-section code-section">

<div class="section-header">
  <h2>Two files. That's the whole contract.</h2>
  <p>The controller declares what data to return and which component renders it. The component receives typed props. TypeScript connects them.</p>
</div>

<div class="code-pair">
<div class="code-block" data-title="recipes.controller.ts">

```typescript
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

</div>
<div class="code-block" data-title="recipe-detail.tsx">

```tsx
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

</div>
</div>

<p class="accent-line">Return the wrong shape and TypeScript catches it before the code runs.</p>

</div>

<div class="footer-cta">

## Add it to an existing NestJS app

<p>One command. Works with Express and Fastify.</p>

`npx @nestjs-ssr/react init`

[Get started](/installation)

</div>
