# Migrating from Next.js to NestJS SSR

A guide for Next.js developers transitioning to @nestjs-ssr/react.

## Table of Contents

- [Mindset Shift: Framework vs. Library](#mindset-shift-framework-vs-library)
- [Routing](#routing)
- [Data Fetching](#data-fetching)
- [API Routes](#api-routes)
- [File Structure](#file-structure)
- [Styling](#styling)
- [Deployment](#deployment)
- [Complete Example](#complete-example)

## Mindset Shift: Framework vs. Library

### Next.js: The Framework Owns Your App

In Next.js, the framework dictates:
- ✗ Routing (file-based, app router, pages router)
- ✗ Data fetching (getServerSideProps, loaders, Server Components)
- ✗ API routes (app/api or pages/api)
- ✗ Deployment (Vercel, edge runtime)
- ✗ Project structure (app/ vs pages/ directory)

You adapt your application to Next.js conventions.

### @nestjs-ssr/react: You Own Your App

With @nestjs-ssr/react:
- ✅ **You control routing** - NestJS controllers define routes
- ✅ **You control data** - NestJS services with dependency injection
- ✅ **You control deployment** - Standard Node.js deployment
- ✅ **You control structure** - Organize by domain, not by framework
- ✅ **React is just the view layer** - Not the application framework

**Key principle:** React renders your data. NestJS handles everything else.

## Routing

### Next.js (File-Based Routing)

```typescript
// app/products/[id]/page.tsx
export default function ProductPage({ params }: { params: { id: string } }) {
  return <div>Product {params.id}</div>;
}
```

Routing is implicit based on file location.

### NestJS SSR (Controller-Based Routing)

```typescript
// products/products.controller.ts
@Controller('products')
export class ProductsController {
  @Get(':id')
  @Render('products/views/product')
  getProduct(@Param('id') id: string) {
    return { productId: id };
  }
}

// products/views/product.tsx
export default function Product({ data }: PageProps<{ productId: string }>) {
  return <div>Product {data.productId}</div>;
}
```

Routing is explicit in controllers. Views are just React components.

### Migration Strategy

**Next.js route → NestJS route:**

| Next.js | NestJS |
|---------|--------|
| `app/page.tsx` | `@Get() @Render('views/home')` |
| `app/about/page.tsx` | `@Get('about') @Render('views/about')` |
| `app/products/[id]/page.tsx` | `@Get('products/:id') @Render('products/views/detail')` |
| `app/blog/[category]/[slug]/page.tsx` | `@Get('blog/:category/:slug')` |

**Benefits:**
- ✅ Full control over route patterns (use regex, wildcards, etc.)
- ✅ Share route guards with REST API
- ✅ Apply interceptors, pipes, and middleware
- ✅ Explicit and searchable (no file-based magic)

## Data Fetching

### Next.js: Framework-Specific APIs

**Server Components (app router):**
```typescript
export default async function ProductPage({ params }) {
  const product = await fetch(`/api/products/${params.id}`).then(r => r.json());
  return <div>{product.name}</div>;
}
```

**getServerSideProps (pages router):**
```typescript
export async function getServerSideProps({ params }) {
  const product = await fetchProduct(params.id);
  return { props: { product } };
}
```

Data fetching happens in React components or Next.js-specific functions.

### NestJS SSR: Standard Dependency Injection

```typescript
// products/products.controller.ts
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get(':id')
  @Render('products/views/detail')
  async getProduct(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    return {
      product,
      head: {
        title: `${product.name} - Our Store`,
        description: product.description,
      },
    };
  }
}

// products/views/detail.tsx
export default function ProductDetail({ data }: PageProps<{ product: Product }>) {
  return <div>{data.product.name}</div>;
}
```

Data fetching happens in the controller using standard NestJS services.

### Migration Strategy

**Next.js pattern → NestJS pattern:**

| Next.js | NestJS |
|---------|--------|
| `fetch()` in Server Component | Service method in controller |
| `getServerSideProps` | Controller method |
| `getStaticProps` | Controller with caching |
| Server Actions | POST endpoint + @Render or redirect |

**Benefits:**
- ✅ Same services for both REST API and SSR
- ✅ Dependency injection for testing and modularity
- ✅ No framework-specific data fetching APIs
- ✅ Apply guards, interceptors, caching at the controller level

## API Routes

### Next.js: API Routes Separate from Pages

```typescript
// app/api/products/[id]/route.ts
export async function GET(request, { params }) {
  const product = await db.products.findUnique({ where: { id: params.id } });
  return Response.json(product);
}
```

API routes are in `app/api/` or `pages/api/`, separate from your pages.

### NestJS SSR: Same Controller, Different Routes

```typescript
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // SSR route
  @Get(':id')
  @Render('products/views/detail')
  async getProduct(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    return { product };
  }

  // API route
  @Get('api/:id')
  async getProductApi(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // Or use the same route with content negotiation
  @Get(':id')
  async getProductDynamic(
    @Param('id') id: string,
    @Headers('accept') accept: string,
  ) {
    const product = await this.productsService.findOne(id);

    if (accept.includes('application/json')) {
      return product;  // JSON response
    }

    return { product };  // SSR response (with @Render decorator)
  }
}
```

**Benefits:**
- ✅ API and SSR routes share the same services
- ✅ DRY - no duplicate logic
- ✅ Same guards, interceptors, validation for both

## File Structure

### Next.js Structure (app router)

```
app/
├── page.tsx              # Homepage
├── about/
│   └── page.tsx
├── products/
│   ├── page.tsx          # Product list
│   ├── [id]/
│   │   └── page.tsx      # Product detail
│   └── layout.tsx
└── api/
    └── products/
        └── route.ts      # API endpoint
```

Structure dictated by routing.

### NestJS SSR Structure (Domain-Driven)

```
src/
├── app.module.ts
├── views/
│   ├── home.tsx          # Homepage view
│   └── about.tsx         # About page view
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts    # Both API and SSR routes
│   ├── products.service.ts       # Business logic
│   ├── products.repository.ts
│   ├── entities/
│   │   └── product.entity.ts
│   └── views/
│       ├── list.tsx              # Product list view
│       └── detail.tsx            # Product detail view
└── users/
    ├── users.module.ts
    ├── users.controller.ts
    ├── users.service.ts
    └── views/
        └── profile.tsx
```

Structure organized by domain, not by routing.

### Migration Strategy

**Recommended structure:**

1. **Create NestJS module per domain** (products, users, orders)
2. **Put views with their domain** (`products/views/`, `users/views/`)
3. **Share components** in `shared/views/components/`
4. **One service per domain** - used by both API and SSR

**Clean Architecture:**
```
products/
├── products.module.ts       # NestJS module
├── products.controller.ts   # HTTP layer (API + SSR)
├── products.service.ts      # Business logic
├── products.repository.ts   # Data access
├── entities/                # Domain models
│   └── product.entity.ts
├── dto/                     # Data transfer objects
│   ├── create-product.dto.ts
│   └── update-product.dto.ts
└── views/                   # Presentation layer
    ├── list.tsx
    └── detail.tsx
```

## Styling

### Next.js: Built-in CSS Solutions

- CSS Modules (built-in)
- Tailwind CSS (official template)
- next/font optimization
- Image optimization with next/image

### NestJS SSR: Bring Your Own

Use any React styling solution:

**Tailwind CSS:**
```typescript
// views/home.tsx
export default function Home() {
  return (
    <div className="bg-blue-500 text-white p-4">
      <h1 className="text-2xl font-bold">Hello</h1>
    </div>
  );
}
```

**CSS Modules:**
```typescript
// views/home.module.css
.container {
  background: blue;
  color: white;
}

// views/home.tsx
import styles from './home.module.css';

export default function Home() {
  return <div className={styles.container}>Hello</div>;
}
```

**CSS-in-JS (Emotion, styled-components):**
```typescript
import styled from '@emotion/styled';

const Container = styled.div`
  background: blue;
  color: white;
`;

export default function Home() {
  return <Container>Hello</Container>;
}
```

**Migration:** Use the same styling solution you used in Next.js.

## Deployment

### Next.js: Vercel-Optimized

- Designed for Vercel
- Edge runtime
- Serverless functions
- ISR (Incremental Static Regeneration)

### NestJS SSR: Standard Node.js

Deploy anywhere Node.js runs:
- VPS (DigitalOcean, AWS EC2)
- PaaS (Heroku, Render, Railway)
- Docker (Docker Hub, ECR)
- Kubernetes
- Serverless (AWS Lambda, but not ideal)

See [Production Deployment Guide](./production-deployment.md) for details.

## Complete Example

### Next.js App

```typescript
// app/products/[id]/page.tsx
import { getProduct } from '@/lib/api';

export default async function ProductPage({ params }) {
  const product = await getProduct(params.id);

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>${product.price}</p>
    </div>
  );
}

// app/api/products/[id]/route.ts
export async function GET(req, { params }) {
  const product = await db.products.findUnique({ where: { id: params.id } });
  return Response.json(product);
}
```

### NestJS SSR Equivalent

```typescript
// products/products.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // SSR route
  @Get(':id')
  @Render('products/views/detail')
  async getProduct(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    return {
      product,
      head: {
        title: `${product.name} - Store`,
        description: product.description,
      },
    };
  }

  // API route (optional, or use content negotiation)
  @Get('api/:id')
  async getProductApi(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}

// products/products.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}

  async findOne(id: string) {
    return this.repository.findOne(id);
  }
}

// products/views/detail.tsx
import type { PageProps } from '@nestjs-ssr/react';
import type { Product } from '../entities/product.entity';

interface DetailData {
  product: Product;
}

export default function ProductDetail({ data }: PageProps<DetailData>) {
  return (
    <html>
      <head>
        <title>{data.product.name}</title>
      </head>
      <body>
        <h1>{data.product.name}</h1>
        <p>{data.product.description}</p>
        <p>${data.product.price}</p>
      </body>
    </html>
  );
}
```

## Key Differences Summary

| Aspect | Next.js | NestJS SSR |
|--------|---------|------------|
| **Philosophy** | Framework owns app | You own app |
| **Routing** | File-based | Controller-based |
| **Data Fetching** | Framework APIs | DI services |
| **API Routes** | Separate from pages | Same controller |
| **Structure** | By route | By domain |
| **Deployment** | Vercel-optimized | Standard Node.js |
| **Learning Curve** | Framework-specific | NestJS + React |

## When to Use Each

### Choose Next.js if:
- 🟢 Building a new React-first app from scratch
- 🟢 Want opinionated framework decisions
- 🟢 Deploying to Vercel
- 🟢 Need edge runtime features
- 🟢 Prefer file-based routing

### Choose NestJS SSR if:
- 🟢 Have existing NestJS backend
- 🟢 Value Clean Architecture
- 🟢 Want full control over structure
- 🟢 Need to share services between API and SSR
- 🟢 Deploy to non-Vercel infrastructure
- 🟢 Prefer explicit, searchable routing

## Next Steps

- 📖 [Getting Started](../getting-started.md)
- 🏗️ [Architecture Overview](../ARCHITECTURE.md)
- 📝 [Your First SSR Page](./your-first-page.md)

---

**Migrating from Next.js?** You already know React. Now you'll appreciate the architectural freedom NestJS SSR provides.

**Questions?** [Open an issue](https://github.com/georgialexandrov/nestjs-ssr/issues) or check the [examples](../../examples/).
