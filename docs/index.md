---
layout: home

hero:
  name: NestJS SSR
  text: React as View Layer
  tagline: Server-side rendered React for NestJS applications.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/installation
    - theme: alt
      text: View on GitHub
      link: https://github.com/georgialexandrov/nestjs-ssr

features:
  - icon: 🏗️
    title: Unified Codebase
    details: Views live alongside controllers and services. No separate frontend repository. No API versioning complexity. One codebase, clear boundaries.
  - icon: 🧪
    title: Testable Architecture
    details: Controllers return data objects - test by asserting values. Components receive props - test by rendering. Each layer tests in isolation.
  - icon: ⚡
    title: Minimal Configuration
    details: Register module, add decorator, return data. Types flow from controllers to components automatically. Vite handles the rest.
---

## Quick Example

```typescript
// 1. Install
npm install @nestjs-ssr/react react react-dom vite

// 2. Register module (app.module.ts)
@Module({
  imports: [RenderModule],
})
export class AppModule {}

// 3. Add controller
@Get('/products/:id')
@Render('views/product-detail')
async getProduct(@Param('id') id: string) {
  return { product: await this.productService.findById(id) };
}

// 4. Create view (views/product-detail.tsx)
export default function ProductDetail({ data }: PageProps<{ product: Product }>) {
  return <h1>{data.product.name}</h1>;
}
```

That's it. Vite initializes automatically in development and production.

## Why This Approach?

This library treats React as a view layer, not the application framework. NestJS handles routing, business logic, and data management. React handles rendering.

**Benefits:**
- Controllers return data (easy to test)
- Components receive props (easy to test)
- Clear separation between layers
- Type safety from routes to components
- No separate SPA making API calls to your backend

Views are just another layer in your architecture. They live alongside controllers and services in domain modules. Clean Architecture doesn't require separate applications - it requires clear boundaries. This keeps both.

[Learn more →](/guide/introduction)
