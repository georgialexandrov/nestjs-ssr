# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@nestjs-ssr/react` - Production-ready React SSR for NestJS. Controllers return data, React components render views.

## Quick Reference

```typescript
// Controller - pass data to React component
@Get('/products/:id')
@Render(ProductDetail)
async getProduct(@Param('id') id: string) {
  const product = await this.productService.findById(id);
  return { product, head: { title: product.name } };
}

// Component - receive typed props
export default function ProductDetail({ data }: PageProps<{ product: Product }>) {
  return <h1>{data.product.name}</h1>;
}
```

## Installation

```bash
npx @nestjs-ssr/react init
```

The init script:

- Installs dependencies (react, vite, @vitejs/plugin-react)
- Creates `src/views/` with entry-client.tsx, entry-server.tsx, index.html
- Updates tsconfig.json for JSX
- Registers RenderModule in app.module.ts
- Adds build scripts to package.json

## Core APIs

### @Render(Component, options?)

Marks controller method to render a React component.

```typescript
@Render(HomePage)                           // Basic
@Render(ProductPage, { layout: AdminLayout }) // With layout override
@Render(ModalPage, { layout: false })        // Skip controller layout
@Render(BarePage, { layout: null })          // Skip ALL layouts
```

### @Layout(Component, options?)

Controller-level decorator for shared layouts.

```typescript
@Controller('admin')
@Layout(AdminLayout, { props: { sidebar: true } })
export class AdminController {
  @Get()
  @Render(Dashboard)
  getDashboard() {
    return { stats: {} };
  }
}
```

### RenderModule Configuration

```typescript
// Zero-config (Vite on port 5173, string mode)
RenderModule.forRoot();

// Full config
RenderModule.forRoot({
  mode: 'stream', // 'string' | 'stream'
  vite: { port: 5173 }, // Vite dev server port
  allowedHeaders: ['x-tenant-id'], // Exposed to client
  allowedCookies: ['theme'], // Exposed to client
  defaultHead: { title: 'My App' }, // Default SEO
});

// Async config
RenderModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config) => ({
    mode: config.get('SSR_MODE'),
  }),
});
```

## File Structure

```
src/
├── app.module.ts         # Import RenderModule
├── app.controller.ts     # @Render decorators
├── main.ts              # Add enableShutdownHooks()
└── views/
    ├── entry-client.tsx # Auto-generated hydration entry
    ├── entry-server.tsx # Auto-generated SSR entry
    ├── index.html       # Template with placeholders
    ├── layout.tsx       # Root layout (auto-discovered)
    └── [pages].tsx      # Page components
```

## SSR Modes

| Mode     | Method                 | Use Case                                    |
| -------- | ---------------------- | ------------------------------------------- |
| `string` | renderToString         | Simple, sync, easier debugging              |
| `stream` | renderToPipeableStream | Better TTFB, Suspense support, lower memory |

## Development

In development, Vite runs as a separate server with HMR. NestJS proxies asset requests to Vite.

```bash
pnpm start:dev  # Runs both Vite and NestJS concurrently
```

Or separately:

```bash
pnpm dev:vite   # Terminal 1: Vite on 5173
pnpm dev:nest   # Terminal 2: NestJS on 3000
```

## Client-Side Hooks

```typescript
import { createSSRHooks, RenderContext } from '@nestjs-ssr/react';

// Extend context with app-specific data
interface AppContext extends RenderContext {
  user?: { id: string; name: string };
}

export const {
  usePageContext, // Full context
  useParams, // Route params { id: '123' }
  useQuery, // Query string { page: '1' }
  useHeader, // useHeader('x-tenant-id')
  useCookie, // useCookie('theme')
} = createSSRHooks<AppContext>();
```

## PageProps Interface

```typescript
// All page components receive this shape
type PageProps<T = {}> = {
  data: T;           // Controller return value
  head?: HeadData;   // SEO data
};

// Usage
interface ProductProps {
  product: Product;
}

export default function ProductPage({ data, head }: PageProps<ProductProps>) {
  return <h1>{data.product.name}</h1>;
}
```

## HeadData (SEO)

```typescript
return {
  product,
  head: {
    title: 'Product Name',
    description: 'Product description',
    canonical: 'https://site.com/product/123',
    ogTitle: 'Product Name',
    ogImage: 'https://site.com/og.jpg',
    meta: [{ name: 'author', content: 'John' }],
    links: [{ rel: 'icon', href: '/favicon.ico' }],
    scripts: [{ src: '/analytics.js', async: true }],
    jsonLd: [{ '@type': 'Product', name: 'X' }],
  },
};
```

## Layout Hierarchy

Resolution order: Root → Controller → Method → Page

```typescript
// Root layout (auto-discovered at src/views/layout.tsx)
export default function RootLayout({ children }: LayoutProps) {
  return <html><body>{children}</body></html>;
}

// Controller layout
@Layout(AdminLayout)

// Method override
@Render(Page, { layout: SpecificLayout })
@Render(Page, { layout: false })  // Skip controller layout
@Render(Page, { layout: null })   // Skip ALL layouts
```

## Build Commands

```bash
pnpm build  # Runs: nest build && build:client && build:server
```

Build order matters:

1. `nest build` - NestJS compilation (has deleteOutDir: true)
2. `build:client` - Vite client bundle + manifest
3. `build:server` - Vite SSR bundle

## Key Internals

| Service                | Responsibility                              |
| ---------------------- | ------------------------------------------- |
| RenderService          | Template loading, string/stream rendering   |
| RenderInterceptor      | Context building, layout resolution         |
| TemplateParserService  | HTML parsing, script injection              |
| ViteInitializerService | Dev server setup, production static serving |
| StreamingErrorHandler  | Shell/stream error handling                 |

## Template Placeholders

```html
<!--app-html-->
<!-- React SSR output -->
<!--initial-state-->
<!-- Serialized props -->
<!--client-scripts-->
<!-- Client bundle -->
<!--styles-->
<!-- CSS from Vite -->
<!--head-meta-->
<!-- SEO tags -->
```

## Common Patterns

### Dynamic SEO

```typescript
@Get('/blog/:slug')
@Render(BlogPost)
async getPost(@Param('slug') slug: string) {
  const post = await this.blogService.findBySlug(slug);
  return {
    post,
    head: {
      title: post.title,
      description: post.excerpt,
      ogImage: post.coverImage,
    }
  };
}
```

### Using Context in Components

```typescript
export default function ProductPage({ data }: PageProps<Props>) {
  const { path, params } = usePageContext();
  const theme = useCookie('theme');
  const tenantId = useHeader('x-tenant-id');

  return <div className={theme}>{data.product.name}</div>;
}
```

### Skipping Layouts

```typescript
// Modal/overlay that shouldn't have layout chrome
@Get('/modal')
@Render(ModalContent, { layout: null })
getModal() { return {}; }
```

## Test Commands

```bash
pnpm test                    # Unit tests (vitest)
pnpm test:integration:dev    # Integration tests (dev mode)
pnpm test:integration:prod   # Integration tests (prod mode)
```

## Exports

```typescript
// Main: @nestjs-ssr/react
import {
  RenderModule,
  Render,
  Layout,
  PageProps,
  RenderContext,
  HeadData,
} from '@nestjs-ssr/react';

// Client: @nestjs-ssr/react/client
import { createSSRHooks, PageContextProvider } from '@nestjs-ssr/react/client';
```
