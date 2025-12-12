# NestJS SSR

[![npm version](https://badge.fury.io/js/%40nestjs-ssr%2Freact.svg)](https://www.npmjs.com/package/@nestjs-ssr/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **⚠️ Preview Release**
> This package is currently in active development. The API may change between minor versions. Production use is not recommended yet.

Server-rendered React for NestJS. Controllers return data, components render it.

Clean Architecture: layers separated, dependencies inward, business logic framework-agnostic.

## When To Use

**Use this when:**

- You have NestJS and want React instead of Handlebars/EJS
- Testable layers matter more than file-based routing
- You want feature modules (controller + service + view together)

**Use Next.js when:**

- You're starting fresh without NestJS
- You want the React ecosystem's defaults
- File-based routing fits your mental model

## Quick Start

```bash
npx nestjs-ssr init
```

```typescript
@Get(':id')
@Render(ProductDetail)
async getProduct(@Param('id') id: string) {
  return { product: await this.productService.findById(id) };
}
```

```tsx
export default function ProductDetail({
  data,
}: PageProps<{ product: Product }>) {
  return <h1>{data.product.name}</h1>;
}
```

Type mismatch = build fails.

## Test in Isolation

```typescript
// Controller: no React
expect(await controller.getProduct('123')).toEqual({ product: { id: '123' } });

// Component: no NestJS
render(<ProductDetail data={{ product: mockProduct }} />);
```

## Features

**Rendering:**

- Type-safe data flow from controller to component
- Hierarchical layouts (module → controller → method)
- Head tags via decorators (title, meta, OG, JSON-LD)

**Request Context:**

- Hooks: params, query, headers, session, user agent
- Whitelist what reaches the client

**Development:**

- Integrated mode: one process, full refresh
- Proxy mode: separate Vite, true HMR

## Docs

[Full documentation →](https://georgialexandrov.github.io/nest-ssr/)

## Examples

**[Minimal](./examples/minimal/)** - Simplest setup with integrated Vite mode
**[Minimal HMR](./examples/minimal-hmr/)** - Dual-server architecture for full HMR

## License

MIT
