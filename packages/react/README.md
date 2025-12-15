# @nestjs-ssr/react

[![npm version](https://img.shields.io/npm/v/@nestjs-ssr/react)](https://www.npmjs.com/package/@nestjs-ssr/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

React as a view layer for NestJS. Controllers return data. Components render it. One app.

**[Documentation](https://georgialexandrov.github.io/nestjs-ssr/)** | **[Getting Started](https://georgialexandrov.github.io/nestjs-ssr/guide/installation)**

## Quick Start

```bash
npx @nestjs-ssr/react init
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
  product,
}: PageProps<{ product: Product }>) {
  return <h1>{product.name}</h1>;
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

## What You Get

**Rendering:**

- Type-safe data flow from controller to component
- Hierarchical layouts (root → controller → method)
- Head tags (title, meta, OG, JSON-LD)
- Stream or string mode

**Request Context:**

- Hooks: `useParams()`, `useQuery()`, `useHeader()`, `useCookie()`
- Whitelist what reaches the client

**Development:**

- Integrated mode: Vite inside NestJS, one process
- Separate mode: standalone Vite server, true HMR

## Requirements

- Node.js 20+
- NestJS 11+
- React 19+
- Vite 6+
- TypeScript 5+

## Documentation

**[georgialexandrov.github.io/nestjs-ssr](https://georgialexandrov.github.io/nestjs-ssr/)**

- [Installation](https://georgialexandrov.github.io/nestjs-ssr/guide/installation)
- [Rendering](https://georgialexandrov.github.io/nestjs-ssr/guide/rendering)
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
