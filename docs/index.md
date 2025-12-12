---
layout: home

hero:
  name: NestJS SSR
  text: React as View Layer
  tagline: MVC architecture with type-safe React components.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/installation
    - theme: alt
      text: View on GitHub
      link: https://github.com/georgialexandrov/nestjs-ssr

features:
  - icon: 🏗️
    title: Clean Architecture
    details: Controllers handle logic. Components handle rendering. No mixing. Each layer owns one responsibility.
  - icon: 🧪
    title: Test Isolation
    details: Test controllers without React. Test components without NestJS. Mock what you need. Ship with confidence.
  - icon: 🔒
    title: Type Safety
    details: Return data from controller, component props match automatically. Wrong type = build fails. Cmd+Click from controller to view. Refactor with confidence.
  - icon: ⚡
    title: Developer Experience
    details: Register module, add decorator, return data. HMR for instant updates. Vite optimizations built-in.
---

## Quick Start

```bash
npx nestjs-ssr init
```

Then add a route:

```typescript
// app.controller.ts
import { Render } from '@nestjs-ssr/react';
import ProductDetail from './views/product-detail';

@Get('/products/:id')
@Render(ProductDetail)
async getProduct(@Param('id') id: string) {
  return { product: await this.productService.findById(id) };
}
```

```tsx
// views/product-detail.tsx
export default function ProductDetail({
  data,
}: PageProps<{ product: Product }>) {
  return <h1>{data.product.name}</h1>;
}
```

Done. Types flow automatically. Tests in isolation.

## Architecture & Testing

Controllers own logic, return data. Components own rendering, receive props. Each layer has one job. Test in isolation.

```typescript
// Test controller - no React needed
expect(controller.getProduct('123')).toEqual({ product: { id: '123' } });

// Test component - no NestJS needed
render(<ProductDetail data={{ product: { id: '123' } }} />);
```

Controllers and views live together in the same module. Open a folder, see the use cases. Know what belongs where. Uncle Bob's Clean Architecture: structure reveals intent.

**Use NestJS SSR when:**

- You have NestJS and want React instead of template engines
- Testable architecture matters more than framework optimizations
- Layered architecture with DI beats file-based routing with mixed logic
- Complete feature modules in one place beat organizing by technical type

## Features

**Customization:**

- Hierarchical layouts (root → controller → method → page)
- SEO head tags (title, meta, Open Graph, JSON-LD)
- Custom error pages and HTML templates
- Filter which headers and cookies pass to client

**Development:**

- Integrated - Vite inside NestJS, one process
- Proxy - Separate Vite server, full HMR

[Get started →](/guide/installation)
