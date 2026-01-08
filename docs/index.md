---
layout: home

hero:
  name: NestJS SSR
  text: React as View Layer
  tagline: Controllers return data. Components render it. Test each independently.
  actions:
    - theme: brand
      text: Get Started
      link: /installation
    - theme: alt
      text: GitHub
      link: https://github.com/georgialexandrov/nestjs-ssr

features:
  - icon: 🏗️
    title: Clean Architecture
    details: Controllers own data. Components own UI. Test each independently. No mocks needed.
  - icon: 🔒
    title: Type Safety
    details: Controller return type = component props. Mismatch fails build. Cmd+Click works.
  - icon: ⚡
    title: Client-Side Routing
    details: SPA-like navigation with partial hydration. Shared layouts persist across pages.
---

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
- Nested layouts (root → controller → method)
- Full SEO support (title, meta, OG, JSON-LD)
- String or streaming SSR modes

**Client:**

- Client-side routing with partial hydration
- Hooks: params, query, headers, cookies
- Context factory for auth/user data

**Development:**

- Vite with HMR
- One command setup

[Get started →](/installation)
