# API Reference

Complete API documentation for NestJS SSR.

## Decorators

### @Render

Marks a controller method for React SSR rendering.

```typescript
@Render(viewPath: string)
```

**Parameters**:
- `viewPath` - Path to the view component relative to `src/`

**Example**:
```typescript
@Controller('products')
export class ProductController {
  @Get(':id')
  @Render('products/views/product-detail')
  async getProduct(@Param('id') id: string) {
    return { product: await this.productService.findById(id) };
  }
}
```

**Behavior**:
- Intercepts the controller's return value
- Passes data to the React component as the `data` prop
- Renders HTML on the server
- Sends HTML response to the browser

Works with async methods. The rendering system waits for promises to resolve.

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

Type for component props with SSR data.

```typescript
interface PageProps<T = any> {
  data: T;
  context: RenderContext;
}
```

**Properties**:
- `data` - Data returned from the controller
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
  render(viewPath: string, data: any, context: RenderContext): Promise<string>
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

#### render

Renders a view component to HTML.

```typescript
render(viewPath: string, data: any, context: RenderContext): Promise<string>
```

Called automatically by the `@Render` decorator. You typically don't call this directly.

## Vite Plugin

### viewRegistryPlugin

Auto-generates the view registry from your codebase.

```typescript
function viewRegistryPlugin(options?: ViewRegistryPluginOptions): Plugin
```

**Options**:
```typescript
interface ViewRegistryPluginOptions {
  pattern?: string;
  registryPath?: string;
}
```

**Properties**:
- `pattern` - Glob pattern for finding views (default: `'src/**/views/*.tsx'`)
- `registryPath` - Output path for registry file (default: `'src/view/view-registry.generated.ts'`)

**Example**:
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viewRegistryPlugin } from '@nestjs-ssr/react/vite';

export default defineConfig({
  plugins: [
    react(),
    viewRegistryPlugin({
      pattern: 'src/**/views/*.tsx',
    }),
  ],
});
```

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

- [Configuration Reference](/reference/configuration) - Detailed configuration options
- [Core Concepts](/guide/core-concepts) - Understand the architecture
- [Troubleshooting](/troubleshooting) - Common issues and solutions
