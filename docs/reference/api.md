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
interface PageProps<T = any> {
  data: T;
  context: RenderContext;
}
```

**Properties**:
- `data` - Data returned from the controller (or `props` field)
- `context` - Request context information

**Example**:
```typescript
interface ProductData {
  product: Product;
}

export default function ProductDetail({ data, context }: PageProps<ProductData>) {
  return <h1>{data.product.name}</h1>;
}
```

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
  links?: Array<Record<string, string>>;
  meta?: Array<Record<string, string>>;
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
- `links` - Custom link tags
- `meta` - Custom meta tags

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
      ]
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
  query: Record<string, any>;
  params: Record<string, string>;
  userAgent?: string;
  acceptLanguage?: string;
  referer?: string;
}
```

**Properties**:
- `url` - Full request URL
- `path` - Path portion of URL (`/products/123`)
- `query` - Parsed query parameters
- `params` - Route parameters
- `userAgent` - User-Agent header
- `acceptLanguage` - Accept-Language header
- `referer` - Referer header

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

### usePageContext

Returns the current render context.

```typescript
function usePageContext(): RenderContext
```

**Example**:
```typescript
import { usePageContext } from '@nestjs-ssr/react';

function MyComponent() {
  const context = usePageContext();
  return <div>Path: {context.path}</div>;
}
```

### useParams

Returns route parameters from the context.

```typescript
function useParams(): Record<string, string>
```

**Example**:
```typescript
import { useParams } from '@nestjs-ssr/react';

function MyComponent() {
  const params = useParams();
  return <div>Product ID: {params.id}</div>;
}
```

### useQuery

Returns query parameters from the context.

```typescript
function useQuery(): Record<string, any>
```

**Example**:
```typescript
import { useQuery } from '@nestjs-ssr/react';

function MyComponent() {
  const query = useQuery();
  return <div>Page: {query.page || 1}</div>;
}
```

## Services

### RenderService

Internal service that handles SSR rendering.

```typescript
class RenderService {
  setViteServer(vite: ViteDevServer): void
  getRootLayout(): Promise<ComponentType | null>
  render(
    component: ComponentType,
    data: any,
    res: Response,
    head?: HeadData
  ): Promise<string>
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
