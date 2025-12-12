# @nestjs-ssr/react

[![npm version](https://badge.fury.io/js/%40nestjs-ssr%2Freact.svg)](https://www.npmjs.com/package/@nestjs-ssr/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **⚠️ Preview Release**
> This package is currently in active development. The API may change between minor versions. Production use is not recommended yet.

Server-side rendered React for NestJS applications. React as your view layer.

**[Documentation](https://georgialexandrov.github.io/nest-ssr/)** | **[Getting Started](https://georgialexandrov.github.io/nest-ssr/guide/getting-started)** | **[Examples](./examples/)**

Building with NestJS? Want React for UI? Don't build two apps. Use React as your view layer. Controllers return data, components render it. One app. Clear boundaries. Ship faster.

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

Controllers own logic, return data. Components own rendering, receive props. Each layer has one responsibility. Each tests independently.

```typescript
// Test controller
expect(controller.getProduct('123')).toEqual({ product: { id: '123' } });

// Test component
render(<ProductDetail data={{ product: { id: '123' } }} />);
```

Clear boundaries scale. This is Clean Architecture applied to SSR.

Next.js mixes layers for performance optimizations. This separates layers for maintainability and testability. Pick your priority.

**Use this when:**

- You have NestJS and need server-rendered views
- You value testable architecture and separation of concerns
- You prefer explicit routing (controllers) over file-based conventions
- You want to add SSR without rebuilding your backend

**Use Next.js when:**

- You need edge rendering or partial prerendering
- You're starting fresh with no existing backend
- Framework-level optimizations matter more than architectural clarity

## Features

**Rendering Modes:**

- Stream (default) - Progressive rendering, React Suspense, lower memory
- String - Complete HTML generation, easier debugging

**Customization:**

- Hierarchical layouts (root → controller → method → page)
- SEO head tags (title, meta, Open Graph, JSON-LD, structured data)
- Custom error pages and HTML templates
- Whitelist-based context (allowedHeaders/allowedCookies)

**Development Modes:**

- Integrated - Vite inside NestJS, one process, simpler setup
- Proxy - Separate Vite server, full HMR, instant updates

**Production:**

- Code splitting and tree shaking
- Asset hashing and caching
- CSS extraction and optimization
- Vite manifest integration

## Documentation

Read the full documentation at **[georgialexandrov.github.io/nest-ssr](https://georgialexandrov.github.io/nest-ssr/)**

- [Getting Started](https://georgialexandrov.github.io/nest-ssr/guide/getting-started)
- [Core Concepts](https://georgialexandrov.github.io/nest-ssr/guide/core-concepts)
- [API Reference](https://georgialexandrov.github.io/nest-ssr/reference/api)

## Examples

**[Minimal](./examples/minimal/)** - Simplest setup with integrated Vite mode
**[Minimal HMR](./examples/minimal-hmr/)** - Dual-server architecture for full HMR
**[Full-Featured](./examples/full-featured/)** - Production-ready with all features

```bash
cd examples/minimal && pnpm start:dev
```

## Requirements

- Node.js 18+
- NestJS 11+
- React 19+
- Vite 6+
- TypeScript 5+

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
git clone https://github.com/georgialexandrov/nestjs-ssr.git
cd nestjs-ssr
pnpm install
pnpm build:package
pnpm test
```

## License

MIT © Georgi Alexandrov
