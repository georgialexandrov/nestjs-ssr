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
  - `'embedded'` - Vite runs inside NestJS (default, no HMR, simplest setup)
  - `'proxy'` - External Vite server with HMR (requires running Vite separately)
- `port` - Port for external Vite server (proxy mode only, default: 5173)

**Examples**:
```typescript
// Zero config - embedded mode (default)
@Module({
  imports: [RenderModule],
})

// Embedded mode (explicit)
RenderModule.register({
  vite: { mode: 'embedded' },
})

// Proxy mode with HMR
RenderModule.register({
  vite: { mode: 'proxy', port: 5173 },
})
```

**When to use**:
- `'embedded'` - Getting started, simple apps, don't need HMR
- `'proxy'` - Active UI development, need instant feedback, complex forms

### mode

Rendering mode for server-side rendering.

```typescript
mode?: 'string' | 'stream'
```

**Default**: `'string'`

**Values**:
- `'string'` - Renders to a complete HTML string before sending
- `'stream'` - Streams HTML progressively as it renders (faster TTFB)

**Example**:
```typescript
RenderModule.register({
  mode: 'stream',
})
```

**When to use**:
- `'string'` - Simple, easier to debug, works everywhere
- `'stream'` - Better performance, progressive rendering with Suspense

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
})
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
})
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

## Vite Configuration

Configure Vite for React and view registry generation.

### Basic Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viewRegistryPlugin } from '@nestjs-ssr/react/vite';

export default defineConfig({
  plugins: [
    react(),
    viewRegistryPlugin(),
  ],
});
```

### View Registry Plugin Options

```typescript
viewRegistryPlugin(options?: ViewRegistryPluginOptions)
```

#### pattern

Glob pattern for finding view components.

```typescript
pattern?: string
```

**Default**: `'src/**/views/*.tsx'`

**Example**:
```typescript
viewRegistryPlugin({
  pattern: 'src/modules/**/views/*.tsx',
})
```

Matches files like:
- `src/modules/users/views/user-list.tsx`
- `src/modules/products/views/product-detail.tsx`

#### registryPath

Output path for the generated registry file.

```typescript
registryPath?: string
```

**Default**: `'src/view/view-registry.generated.ts'`

**Example**:
```typescript
viewRegistryPlugin({
  registryPath: 'src/generated/views.ts',
})
```

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
    })
  );
}
```

## Build Configuration

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"nest start --watch\"",
    "build": "vite build --outDir dist/client && vite build --ssr src/view/entry-server.tsx --outDir dist/server && nest build",
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

Override the HTML template:

```typescript
// src/view/index.html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
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
