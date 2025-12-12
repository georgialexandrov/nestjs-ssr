# API Reference

Complete API documentation for NestJS SSR.

## Decorators

### @Render

Marks a controller method for React SSR rendering with type-safe component references.

```typescript
@Render(component: ComponentType, options?: RenderOptions)
```

**Parameters**:

- `component` - React component to render (imported directly)
- `options` - Optional rendering configuration

**Options**:

```typescript
interface RenderOptions {
  layout?: ComponentType | null | false;
  layoutProps?: Record<string, any>;
}
```

- `layout` - Layout component to wrap the page
  - Component: Use this layout
  - `null`: Skip all layouts (except root)
  - `false`: Skip controller layout only
- `layoutProps` - Static props for the layout

**Basic Example**:

```typescript
import ProductDetail from './views/product-detail';

@Controller('products')
export class ProductController {
  @Get(':id')
  @Render(ProductDetail)
  async getProduct(@Param('id') id: string) {
    return { product: await this.productService.findById(id) };
  }
}
```

**With Layout Example**:

```typescript
import Dashboard from './views/dashboard';
import DashboardLayout from './views/layouts/dashboard.layout';

@Get('dashboard')
@Render(Dashboard, {
  layout: DashboardLayout,
  layoutProps: { activeTab: 'overview' }
})
getDashboard() {
  return { stats: { users: 1234 } };
}
```

**Return Value**:

Simple form (auto-wrapped):

```typescript
@Render(Home)
getHome() {
  return { message: 'Hello' };  // Auto-wrapped as { props: { message: 'Hello' } }
}
```

Advanced form with head and layout props:

```typescript
@Render(UserProfile)
getUser(@Param('id') id: string) {
  const user = await this.userService.findById(id);
  return {
    props: { user },
    layoutProps: {
      title: user.name,
      subtitle: 'Profile'
    },
    head: {
      title: `${user.name} - Profile`,
      description: user.bio,
    }
  };
}
```

**Type Safety**:

```typescript
interface HomeProps {
  message: string;
}

export default function Home(props: PageProps<HomeProps>) {
  return <h1>{props.message}</h1>;
}

@Render(Home)
getHome() {
  return { message: 'Hello' };  // ✅ Type-checked!
  // return { wrong: 'data' };  // ❌ TypeScript error
}
```

### @Layout

Applies a layout to all routes in a controller.

```typescript
@Layout(component: ComponentType, props?: Record<string, any>)
```

**Parameters**:

- `component` - Layout component to wrap all routes
- `props` - Optional static props for the layout

**Example**:

```typescript
import MainLayout from './layouts/main.layout';

@Controller()
@Layout(MainLayout, { title: 'My App' })
export class AppController {
  @Get()
  @Render(Home)
  getHome() {
    return { message: 'Hello' };
  }

  @Get('about')
  @Render(About)
  getAbout() {
    return { message: 'About' };
  }
}
```

Both routes will use `MainLayout` with `{ title: 'My App' }`.

**Hierarchy**:

- Root Layout (auto-discovered) wraps everything
- Controller Layout (from `@Layout`) wraps controller routes
- Method Layout (from `@Render` options) wraps specific route
- Page Component (from `@Render`) is the content

## Modules

### RenderModule

Configures and provides the rendering system.

```typescript
RenderModule.register(options?: RenderModuleOptions)
```

**Options**:

```typescript
interface RenderModuleOptions {
  mode?: 'string' | 'stream';
  errorPageDevelopment?: React.ComponentType<ErrorPageProps>;
  errorPageProduction?: React.ComponentType<ErrorPageProps>;
}
```

**Properties**:

- `mode` - SSR rendering mode (default: `'string'`)
  - `'string'` - Render to complete HTML string before sending
  - `'stream'` - Stream HTML progressively as it renders
- `errorPageDevelopment` - Custom error page for development
- `errorPageProduction` - Custom error page for production

**Example**:

```typescript
@Module({
  imports: [
    RenderModule.register({
      mode: 'stream',
    }),
  ],
})
export class AppModule {}
```

## Types

### PageProps

Type for page component props with SSR data.

```typescript
type PageProps<T = {}> = T & {
  head?: HeadData;
};
```

**Properties**:

- Spreads your controller data directly as props (React-standard pattern)
- `head` - Optional SEO metadata from controller

**Example**:

```typescript
import { useRequest } from '@/lib/ssr-hooks';

interface ProductPageProps {
  product: Product;
}

export default function ProductDetail(props: PageProps<ProductPageProps>) {
  const { product, head } = props;
  const request = useRequest(); // Access request context via hook

  return (
    <div>
      <h1>{product.name}</h1>
      <p>Current path: {request.path}</p>
    </div>
  );
}
```

**Note**: Request context is no longer passed as a prop. Use hooks from `createSSRHooks()` (see [Hooks section](#hooks)) to access context in components.

### LayoutProps

Type for layout component props.

```typescript
interface LayoutProps<T = any> {
  children: React.ReactNode;
  layoutProps?: T;
}
```

**Properties**:

- `children` - Nested content (next layout or page)
- `layoutProps` - Props passed to the layout

**Example**:

```typescript
interface MainLayoutProps {
  title: string;
  subtitle?: string;
}

export default function MainLayout({
  children,
  layoutProps,
}: LayoutProps<MainLayoutProps>) {
  const { title, subtitle } = layoutProps || {};

  return (
    <div>
      <header>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <main>{children}</main>
    </div>
  );
}
```

### RenderResponse

Type for controller return values with additional rendering options.

```typescript
interface RenderResponse<T = any> {
  props: T;
  head?: HeadData;
  layoutProps?: Record<string, any>;
}
```

**Properties**:

- `props` - Props passed to the page component
- `head` - SEO meta tags and page metadata (optional)
- `layoutProps` - Props passed to all layouts in the hierarchy (optional)

**Example**:

```typescript
@Render(UserProfile)
async getUser(@Param('id') id: string) {
  const user = await this.userService.findById(id);

  return {
    props: { user },
    layoutProps: {
      title: user.name,
      breadcrumbs: ['Home', 'Users', user.name]
    },
    head: {
      title: `${user.name} - Profile`,
      description: user.bio,
      ogImage: user.avatar,
    }
  };
}
```

**Auto-wrapping**:
If you return an object without a `props` field, it's auto-wrapped:

```typescript
return { message: 'Hello' };
// Becomes: { props: { message: 'Hello' } }
```

### HeadData

Type for HTML head metadata and SEO tags.

```typescript
interface HeadData {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  links?: Array<{
    rel: string;
    href: string;
    [key: string]: string;
  }>;
  meta?: Array<{
    name?: string;
    property?: string;
    content: string;
    [key: string]: string;
  }>;
  scripts?: Array<{
    src?: string;
    innerHTML?: string;
    async?: boolean;
    defer?: boolean;
    type?: string;
    [key: string]: any;
  }>;
  jsonLd?: Array<Record<string, any>>;
  htmlAttributes?: Record<string, string>;
  bodyAttributes?: Record<string, string>;
}
```

**Properties**:

- `title` - Page title (`<title>`)
- `description` - Meta description
- `keywords` - Meta keywords
- `canonical` - Canonical URL
- `ogTitle` - Open Graph title
- `ogDescription` - Open Graph description
- `ogImage` - Open Graph image URL
- `links` - Custom link tags (stylesheets, preloads, etc.)
- `meta` - Custom meta tags (robots, viewport, social media, etc.)
- `scripts` - Custom script tags (analytics, tracking, etc.)
- `jsonLd` - JSON-LD structured data for rich search results
- `htmlAttributes` - Attributes for the `<html>` tag (e.g., `lang`)
- `bodyAttributes` - Attributes for the `<body>` tag (e.g., `class`)

**Example**:

```typescript
@Render(ProductDetail)
async getProduct(@Param('id') id: string) {
  const product = await this.productService.findById(id);

  return {
    props: { product },
    head: {
      title: `${product.name} - Store`,
      description: product.description,
      keywords: product.tags.join(', '),
      canonical: `https://example.com/products/${id}`,
      ogTitle: product.name,
      ogDescription: product.description,
      ogImage: product.image,
      links: [
        { rel: 'preload', href: product.image, as: 'image' }
      ],
      meta: [
        { name: 'robots', content: 'index,follow' },
        { property: 'product:price:amount', content: product.price }
      ],
      scripts: [
        {
          src: 'https://analytics.example.com/script.js',
          async: true,
        },
      ],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image: product.image,
          offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: 'USD',
          },
        },
      ],
      htmlAttributes: { lang: 'en' },
      bodyAttributes: { class: 'product-page' },
    }
  };
}
```

### RenderContext

Request context available to all components.

```typescript
interface RenderContext {
  url: string;
  path: string;
  method: string;
  query: Record<string, any>;
  params: Record<string, string>;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  userAgent?: string;
  acceptLanguage?: string;
  referer?: string;
}
```

**Properties**:

- `url` - Full request URL
- `path` - Path portion of URL (`/products/123`)
- `method` - HTTP method (`GET`, `POST`, etc.)
- `query` - Parsed query parameters
- `params` - Route parameters
- `headers` - All request headers
- `cookies` - Parsed cookies
- `userAgent` - User-Agent header (convenience accessor)
- `acceptLanguage` - Accept-Language header (convenience accessor)
- `referer` - Referer header (convenience accessor)

**Extending**:

```typescript
// types/render-context.d.ts
declare module '@nestjs-ssr/react' {
  interface RenderContext {
    user?: User;
    tenant: string;
  }
}
```

## Hooks

All hooks work on both server and client side, providing seamless access to request context.

### createSSRHooks

**Factory function** to create typed SSR hooks bound to your app's context type. Use this once in your app to create hooks with full type safety.

```typescript
function createSSRHooks<T extends RenderContext = RenderContext>(): {
  usePageContext: () => T;
  useParams: () => Record<string, string>;
  useQuery: () => Record<string, string | string[]>;
  useUserAgent: () => string | undefined;
  useAcceptLanguage: () => string | undefined;
  useReferer: () => string | undefined;
  useRequest: () => T;
};
```

**Why use createSSRHooks?**

- **Type Safety**: Define your context type once, get full IntelliSense everywhere
- **No Repetition**: No need to pass generic types to every hook call
- **Better DX**: Cleaner code, better autocomplete, catch errors at compile time
- **Pattern**: Same approach used by tRPC, TanStack Query, and other modern libraries

**Setup (Do this once)**:

```typescript
// src/lib/ssr-hooks.ts
import { createSSRHooks, RenderContext } from '@nestjs-ssr/react';

// Define your extended context interface
interface AppRenderContext extends RenderContext {
  user?: {
    id: string;
    name: string;
    email: string;
  };
  tenant?: { id: string; name: string };
  featureFlags?: Record<string, boolean>;
  theme?: string; // From allowedCookies: ['theme']
}

// Create and export typed hooks
export const {
  usePageContext,
  useParams,
  useQuery,
  useUserAgent,
  useAcceptLanguage,
  useReferer,
  useRequest,
} = createSSRHooks<AppRenderContext>();

// Optional: Create custom helper hooks
export const useUser = () => usePageContext().user;
export const useTheme = () => usePageContext().theme || 'light';
export const useFeatureFlag = (flag: string) => {
  const { featureFlags } = usePageContext();
  return featureFlags?.[flag] ?? false;
};
```

**Usage (Use everywhere)**:

```typescript
// src/views/home.tsx
import { usePageContext, useParams, useQuery } from '@/lib/ssr-hooks';

export default function Home() {
  // ✅ Fully typed! IntelliSense shows all properties
  const { user, featureFlags, theme } = usePageContext();
  const params = useParams(); // { id: string, ... }
  const query = useQuery(); // { page?: string, ... }

  return (
    <div>
      <h1>Welcome {user?.name}</h1>
      <p>Theme: {theme}</p>
      <p>Product ID: {params.id}</p>
      <p>Page: {query.page || 1}</p>
    </div>
  );
}
```

**Returned Hooks**:

#### usePageContext()

Returns the full request context with your custom type.

```typescript
const context = usePageContext(); // Returns AppRenderContext
```

#### useParams()

Returns route parameters from the URL.

```typescript
const params = useParams(); // Returns Record<string, string>
// Route: /products/:id → { id: '123' }
```

#### useQuery()

Returns query string parameters from the URL.

```typescript
const query = useQuery(); // Returns Record<string, string | string[]>
// URL: /search?q=react&tags=ssr&tags=nest → { q: 'react', tags: ['ssr', 'nest'] }
```

#### useUserAgent()

Returns the User-Agent header from the request.

```typescript
const userAgent = useUserAgent(); // Returns string | undefined
const isMobile = /Mobile/.test(userAgent || '');
```

#### useAcceptLanguage()

Returns the Accept-Language header from the request.

```typescript
const language = useAcceptLanguage(); // Returns string | undefined
const locale = language?.split(',')[0] || 'en';
```

#### useReferer()

Returns the Referer header from the request.

```typescript
const referer = useReferer(); // Returns string | undefined
if (referer) {
  console.log(`User came from: ${referer}`);
}
```

#### useRequest()

Alias for `usePageContext()` with a more intuitive name.

```typescript
const request = useRequest(); // Returns AppRenderContext
// Same as usePageContext(), use whichever you prefer
```

### PageContextProvider

Provider component that makes page context available to all child components. This is used internally by the framework - you typically don't need to use it directly.

```typescript
function PageContextProvider({
  context,
  children,
}: {
  context: RenderContext;
  children: React.ReactNode;
}): JSX.Element;
```

The framework automatically wraps your app with `PageContextProvider` in both `entry-server.tsx` and `entry-client.tsx`.

## Services

### RenderService

Internal service that handles SSR rendering.

```typescript
class RenderService {
  setViteServer(vite: ViteDevServer): void;
  getRootLayout(): Promise<ComponentType | null>;
  render(
    component: ComponentType,
    data: any,
    res: Response,
    head?: HeadData,
  ): Promise<string>;
}
```

**Methods**:

#### setViteServer

Sets the Vite dev server instance for development mode.

```typescript
setViteServer(vite: ViteDevServer): void
```

**Example**:

```typescript
// main.ts
const renderService = app.get(RenderService);

if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
  });
  renderService.setViteServer(vite);
}
```

#### getRootLayout

Auto-discovers and returns the root layout component if it exists.

```typescript
getRootLayout(): Promise<ComponentType | null>
```

Searches for layout files at conventional paths:

1. `src/views/layout.tsx`
2. `src/views/layout/index.tsx`
3. `src/views/_layout.tsx`

Returns `null` if no layout is found. Results are cached after first check.

Called automatically by the `RenderInterceptor`. You typically don't call this directly.

#### render

Renders a component to HTML.

```typescript
render(
  component: ComponentType,
  data: any,
  res: Response,
  head?: HeadData
): Promise<string>
```

Called automatically by the `@Render` decorator. You typically don't call this directly.

## Environment Variables

### NODE_ENV

Controls production optimizations.

```bash
NODE_ENV=production
```

**Values**:

- `'production'` - Use pre-built assets, disable dev server
- `'development'` - Enable Vite dev server, HMR, source maps

**Effects**:

- Production mode serves from `dist/client/` and `dist/server/`
- Development mode uses Vite middleware for HMR
- Error pages differ between modes

## Next Steps

- [Layouts Guide](/guide/layouts) - Nested layouts and composition
- [Head Tags Guide](/guide/head-tags) - SEO and metadata
- [Configuration Reference](/reference/configuration) - Detailed configuration options
- [Core Concepts](/guide/core-concepts) - Understand the architecture
