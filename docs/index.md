---
layout: home

hero:
  name: NestJS SSR
  text: React as View Layer
  tagline: Controllers return data. Components render it. Test each independently.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/installation
    - theme: alt
      text: GitHub
      link: https://github.com/georgialexandrov/nestjs-ssr

features:
  - icon: 🏗️
    title: Clean Architecture
    details: Layers separated. Dependencies point inward. Business logic stays framework-agnostic.
  - icon: 🔒
    title: Type Safety
    details: Controller return type = component props. Mismatch fails build. Cmd+Click works.
  - icon: ⚡
    title: Vite
    details: HMR in dev. Optimized bundles in prod. One command setup.
---

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

## What You Get

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

[Get started →](/guide/installation)
