# Configuration

Configuration options for NestJS SSR.

## RenderModule Options

Configure the rendering system when registering the module.

```typescript
RenderModule.register(options?: RenderModuleOptions)
```

### vite

Vite development server configuration.

```typescript
vite?: {
  mode?: 'embedded' | 'proxy'
  port?: number
}
```

**Default**: `{ mode: 'embedded' }`

**Options**:

- `mode` - Vite server mode:
  - `'embedded'` - Vite runs inside NestJS with full HMR (default, simplest setup)
  - `'proxy'` - External Vite server with HMR (requires running Vite separately)
- `port` - Port for external Vite server (proxy mode only, default: 5173)

**Examples**:

```typescript
// Zero config - embedded mode with HMR (default)
@Module({
  imports: [RenderModule],
})

// Embedded mode (explicit)
RenderModule.register({
  vite: { mode: 'embedded' },
})

// Proxy mode with separate Vite server
RenderModule.register({
  vite: { mode: 'proxy', port: 5173 },
})
```

**When to use**:

- `'embedded'` - Most projects (default), zero-config with full HMR
- `'proxy'` - Large applications, maximum HMR performance, separate process isolation

### mode

Rendering mode for server-side rendering.

```typescript
mode?: 'string' | 'stream'
```

**Default**: `'stream'`

**Values**:

- `'stream'` - Streams HTML progressively as it renders (recommended)
- `'string'` - Renders to a complete HTML string before sending

**Example**:

```typescript
// Use stream mode (default, recommended for production)
RenderModule.register({
  mode: 'stream',
});

// Use string mode for specific use cases
RenderModule.register({
  mode: 'string',
});
```

**Why both modes exist**:

Both modes serve different purposes based on your requirements:

**Stream Mode (Default, Recommended)**:

- ✅ **Better TTFB** - Browser receives HTML immediately, faster perceived performance
- ✅ **React Suspense support** - Progressive rendering as async data becomes ready
- ✅ **Lower memory usage** - No need to buffer entire HTML string in memory
- ✅ **Modern best practice** - Recommended by React team for production SSR
- ⚠️ **Complex error handling** - Errors after headers sent cannot change status code
- ⚠️ **No post-processing** - Cannot modify complete HTML before sending

**String Mode**:

- ✅ **Simpler error handling** - Full error page with proper status codes (headers not sent yet)
- ✅ **Easier debugging** - Complete HTML string can be inspected, logged, or modified
- ✅ **Atomic responses** - Either entire page succeeds or fails cleanly
- ✅ **HTML post-processing** - Apply transformations, minification, or CSP injection
- ✅ **Testing friendly** - Easier to test complete HTML output
- ✅ **Universal compatibility** - Works with all middleware and deployment environments
- ⚠️ **Slower TTFB** - Waits for complete rendering before sending any bytes
- ⚠️ **Higher memory** - Buffers entire HTML string in memory

**When to use Stream Mode**:

- Production applications (default recommendation)
- Apps with React Suspense and async data fetching
- Large pages where users should see content sooner
- Performance-critical applications where TTFB matters

**When to use String Mode**:

- Development and debugging (easier to inspect complete output)
- Testing environments (simpler to assert against complete HTML)
- Apps requiring HTML post-processing (minification, CSP headers, etc.)
- Simple applications without Suspense
- Environments with middleware that needs complete HTML
- When you need guaranteed proper error pages with correct HTTP status codes

**Performance Comparison**:

```typescript
// String mode timeline:
// [====render complete====][====send all HTML====]
// TTFB: Waits for full render

// Stream mode timeline:
// [====render + send simultaneously====]
// TTFB: Immediate, HTML chunks sent as ready
```

See the [Performance Guide](/guide/performance#streaming-mode) for detailed optimization strategies.

### errorPageDevelopment

Custom error page component for development mode.

```typescript
errorPageDevelopment?: React.ComponentType<ErrorPageProps>
```

**Default**: Built-in error page with stack traces

**Example**:

```typescript
import { ErrorPage } from './components/error-page';

RenderModule.register({
  errorPageDevelopment: ErrorPage,
});
```

```typescript
// components/error-page.tsx
import { ErrorPageProps } from '@nestjs-ssr/react';

export function ErrorPage({ error, stack }: ErrorPageProps) {
  return (
    <div>
      <h1>Error in Development</h1>
      <p>{error.message}</p>
      <pre>{stack}</pre>
    </div>
  );
}
```

### errorPageProduction

Custom error page component for production mode.

```typescript
errorPageProduction?: React.ComponentType<ErrorPageProps>
```

**Default**: Generic error page without sensitive information

**Example**:

```typescript
import { ProductionErrorPage } from './components/production-error-page';

RenderModule.register({
  errorPageProduction: ProductionErrorPage,
});
```

```typescript
// components/production-error-page.tsx
export function ProductionErrorPage() {
  return (
    <div>
      <h1>Something went wrong</h1>
      <p>Please try again later.</p>
    </div>
  );
}
```

### defaultHead

Default head metadata applied to all pages.

```typescript
defaultHead?: HeadData
```

**Default**: None

**Example**:

```typescript
RenderModule.register({
  defaultHead: {
    title: 'My App',
    description: 'Default description for all pages',
    links: [{ rel: 'icon', href: '/favicon.ico' }],
    meta: [
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  },
});
```

Page-specific head data will override default values for the same properties. Arrays like `links` and `meta` are merged rather than replaced.

### allowedHeaders

HTTP headers to pass to client-side context (security opt-in).

```typescript
allowedHeaders?: string[]
```

**Default**: `[]` (no headers passed by default)

**Security**: Headers are **not** included in `RenderContext` by default. Use this option to opt-in to specific headers that are safe to expose to the client.

**Example**:

```typescript
RenderModule.register({
  // Only these headers will be added to context
  allowedHeaders: ['x-tenant-id', 'x-api-version', 'x-custom-header'],
});
```

**Usage in components**:

```typescript
// src/lib/ssr-hooks.ts - Extend context interface
interface AppRenderContext extends RenderContext {
  'x-tenant-id'?: string;
  'x-api-version'?: string;
}

export const { usePageContext } = createSSRHooks<AppRenderContext>();

// src/views/dashboard.tsx
const context = usePageContext();
const tenantId = context['x-tenant-id']; // ✅ Typed and available
```

**Security Warning**:

❌ **NEVER include sensitive headers**:

- `authorization`
- `cookie`
- `x-api-key`
- `x-auth-token`
- Any header containing authentication credentials

✅ **Only include public, non-sensitive headers**:

- `x-tenant-id` (if public)
- `x-api-version`
- `x-request-id`
- Custom business logic headers that are safe to expose

### allowedCookies

Cookie names to pass to client-side context (security opt-in).

```typescript
allowedCookies?: string[]
```

**Default**: `[]` (no cookies passed by default)

**Security**: Cookies are **not** included in `RenderContext` by default. Use this option to opt-in to specific cookies that are safe to expose to the client.

**Example**:

```typescript
RenderModule.register({
  // Only these cookies will be added to context
  allowedCookies: ['theme', 'locale', 'consent'],
});
```

**Usage in components**:

```typescript
// src/lib/ssr-hooks.ts - Extend context interface
interface AppRenderContext extends RenderContext {
  cookies?: {
    theme?: string;
    locale?: string;
    consent?: string;
  };
}

export const { usePageContext } = createSSRHooks<AppRenderContext>();

// src/views/home.tsx
const context = usePageContext();
const theme = context.cookies?.theme || 'light'; // ✅ Typed and available
```

**Security Warning**:

❌ **NEVER include sensitive cookies**:

- Session tokens
- Authentication tokens (JWT, etc.)
- CSRF tokens
- Any cookie used for authentication/authorization

✅ **Only include public, non-sensitive cookies**:

- `theme` (light/dark mode preference)
- `locale` (language preference)
- `consent` (cookie consent status)
- UI preferences that don't contain sensitive data

**Accessing allowed cookies**:

When `allowedCookies` is configured, a `cookies` object is added to the context containing only the specified cookies:

```typescript
// Module config
RenderModule.register({
  allowedCookies: ['theme', 'locale'],
});

// In component
const { cookies } = usePageContext();
console.log(cookies); // { theme: 'dark', locale: 'en-US' }
```

### template

Custom HTML template for SSR rendering.

```typescript
template?: string
```

**Default**: Built-in template from `@nestjs-ssr/react/templates/index.html`

**Example**:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const customTemplate = readFileSync(
  join(__dirname, '../templates/custom.html'),
  'utf-8',
);

RenderModule.register({
  template: customTemplate,
});
```

**Template placeholders**:

- `<!--app-head-->` - Replaced with meta tags, stylesheets, scripts
- `<!--app-html-->` - Replaced with rendered React component
- `<!--app-scripts-->` - Replaced with hydration scripts and data

## Vite Configuration

Configure Vite for React with the required alias for view auto-discovery.

### Basic Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

The `@` alias is required for client-side hydration. The entry-client.tsx file (located in `src/views/`) uses `import.meta.glob('@/views/**/*.tsx')` to auto-discover view components.

### Server Configuration

```typescript
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
```

**Options**:

- `port` - Vite dev server port (default: 5173)
- `strictPort` - Exit if port is already in use
- `hmr.port` - WebSocket port for HMR

## Environment Variables

### NODE_ENV

Controls production mode.

```bash
NODE_ENV=production
```

**Values**:

- `'production'` - Production mode
- `'development'` - Development mode (default)

**Effects**:

- Asset loading from `dist/` in production
- Vite dev server in development
- Error page selection
- Cache headers
- Performance optimizations

## TypeScript Configuration

### Path Aliases

```json
{
  "compilerOptions": {
    "paths": {
      "@view/*": ["src/view/*"],
      "@components/*": ["src/components/*"]
    }
  }
}
```

Import with aliases:

```typescript
import { Layout } from '@components/layout';
```

### JSX Transform

```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

Enables modern JSX transform. No need to import React in every file.

## Main.ts Configuration

### Development Setup

```typescript
import { NestFactory } from '@nestjs/common';
import { createServer as createViteServer } from 'vite';
import { RenderService } from '@nestjs-ssr/react';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const renderService = app.get(RenderService);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);
    renderService.setViteServer(vite);
  }

  await app.listen(3000);
}
```

### Production Setup

```typescript
import express from 'express';

if (process.env.NODE_ENV === 'production') {
  app.use(
    '/assets',
    express.static('dist/client/assets', {
      setHeaders: (res, path) => {
        if (/\.[a-f0-9]{8,}\.(js|css)$/.test(path)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
}
```

## Build Configuration

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"nest start --watch\"",
    "build": "vite build --outDir dist/client && vite build --ssr src/views/entry-server.tsx --outDir dist/server && nest build",
    "start": "NODE_ENV=production node dist/main.js"
  }
}
```

**Scripts**:

- `dev` - Start development servers
- `build` - Build for production
- `start` - Run production server

### Build Output

```
dist/
├── client/          # Client bundles
│   ├── assets/      # Hashed JS/CSS
│   └── index.html
├── server/          # SSR bundle
│   └── entry-server.js
└── main.js          # NestJS app
```

## Advanced Configuration

### Custom Template

Override the HTML template by creating your own template file:

```html
<!-- Custom template location -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <!--app-head-->
  </head>
  <body>
    <div id="root"><!--app-html--></div>
    <!--app-scripts-->
  </body>
</html>
```

Placeholders:

- `<!--app-head-->` - Meta tags, stylesheets
- `<!--app-html-->` - Rendered component
- `<!--app-scripts-->` - Hydration scripts

### Extending Context

Add custom fields to render context:

```typescript
// types/render-context.d.ts
declare module '@nestjs-ssr/react' {
  interface RenderContext {
    user?: {
      id: string;
      name: string;
    };
    tenant: string;
  }
}
```

Populate in an interceptor:

```typescript
@Injectable()
export class ContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    request.renderContext = {
      ...request.renderContext,
      user: request.user,
      tenant: request.headers['x-tenant-id'],
    };
    return next.handle();
  }
}
```

## Next Steps

- [API Reference](/reference/api) - Complete API documentation
- [Production Deployment](/guide/production) - Deploy your application
- [Troubleshooting](/troubleshooting) - Common issues and solutions
